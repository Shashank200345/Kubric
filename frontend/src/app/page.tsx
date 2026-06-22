"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { insforge } from '@/lib/insforge';

interface ProgressStep {
  id: string;
  session_id: string;
  step: string;
  status: string;
  created_at: string;
}

interface Investigation {
  id: string;
  user_id: string;
  status: string;
  root_cause: string | null;
  explanation: string | null;
  fix: string | null;
  kubectl_command: string | null;
  confidence: number | null;
  created_at: string;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [currentInvestigation, setCurrentInvestigation] = useState<Investigation | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clusters, setClusters] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>('');

  const channelRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (cancelled) return;
      if (error || !data?.user) {
        router.push('/login');
      } else {
        setUser(data.user);
        setAuthLoading(false);
        fetchHistory();
        fetchClusters();
      }
    }

    hydrateAuth();
    return () => { cancelled = true; };
  }, [router]);

  const fetchClusters = async () => {
    try {
      const res = await fetch('http://localhost:8000/clusters');
      if (res.ok) {
        const data = await res.json();
        setClusters(data.clusters || []);
        if (data.clusters && data.clusters.length > 0) {
          setSelectedCluster(data.clusters[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch clusters", e);
    }
  };

  const fetchHistory = async () => {
    const { data, error } = await insforge.database
      .from('investigations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setInvestigations(data as Investigation[]);
    }
  };

  const handleInvestigate = async () => {
    if (isInvestigating || !user) return;
    setIsInvestigating(true);
    setCurrentInvestigation(null);
    setProgressSteps([]);
    setError(null);

    try {
      const { data: invData, error: insertError } = await insforge.database
        .from('investigations')
        .insert([{ user_id: user.id }])
        .select()
        .single();

      if (insertError) throw insertError;

      const inv = invData as Investigation;
      setCurrentInvestigation(inv);

      const channel = `investigation:${inv.id}`;
      channelRef.current = channel;
      const response = await insforge.realtime.subscribe(channel);

      if (!response.ok) {
        console.error("Realtime subscribe failed:", response.error?.message);
      }

      insforge.realtime.on('progress_updated', (message: any) => {
        if (message.meta?.channel !== channel) return;

        if (message.step) {
          setProgressSteps(prev => {
            if (prev.find(p => p.id === message.id)) return prev;
            return [...prev, message as ProgressStep];
          });
        }

        if (message.status === 'completed') {
          setCurrentInvestigation(message as Investigation);
          setIsInvestigating(false);
          insforge.realtime.unsubscribe(channel);
          channelRef.current = null;
          fetchHistory();
        }

        if (message.status === 'failed') {
          setError('Investigation failed. Check backend logs.');
          setIsInvestigating(false);
          insforge.realtime.unsubscribe(channel);
          channelRef.current = null;
        }
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      // Fallback polling for progress in case realtime is blocked or RLS prevents frontend reads
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/investigate/${inv.id}/progress`);
          if (res.ok) {
            const data = await res.json();
            if (data.progress && data.progress.length > 0) {
              setProgressSteps(data.progress as ProgressStep[]);
            }
          }
        } catch (e) {
          console.error("Progress polling failed:", e);
        }
      }, 1000);

      try {
        const res = await fetch('http://localhost:8000/investigate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            investigation_id: inv.id,
            cluster_context: selectedCluster || null
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        clearInterval(pollInterval);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || 'Backend investigation failed');
        }

        const { data: finalInv } = await insforge.database
          .from('investigations')
          .select('*')
          .eq('id', inv.id)
          .single();

        if (finalInv) {
          setCurrentInvestigation(finalInv as Investigation);
        }

      } catch (fetchErr: any) {
        clearTimeout(timeout);
        clearInterval(pollInterval);
        if (fetchErr.name === 'AbortError') {
          setError('Investigation timed out after 2 minutes.');
        } else {
          setError(fetchErr.message || 'Failed to reach backend.');
        }
      }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsInvestigating(false);
      if (channelRef.current) {
        insforge.realtime.unsubscribe(channelRef.current);
        channelRef.current = null;
      }
    }
  };

  const handleSignOut = async () => {
    if (channelRef.current) insforge.realtime.unsubscribe(channelRef.current);
    await insforge.auth.signOut();
    router.push('/login');
  };

  const viewHistoryItem = async (inv: Investigation) => {
    setCurrentInvestigation(inv);
    setProgressSteps([]);
    try {
      const res = await fetch(`http://localhost:8000/investigate/${inv.id}/progress`);
      if (res.ok) {
        const data = await res.json();
        if (data.progress) setProgressSteps(data.progress as ProgressStep[]);
      }
    } catch (e) {
      console.error("Failed to load history progress:", e);
    }
    
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 font-sans selection:bg-blue-500/30 pb-20">
      
      {/* Header */}
      <header className="flex justify-between items-center py-6 px-4 sm:px-8 max-w-7xl mx-auto border-b border-gray-800/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Signed in as</span>
            <span className="text-sm font-medium text-gray-200">{user?.email}</span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Main Title */}
      <div className="text-center mt-12 mb-10 px-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-blue-50 mb-4 tracking-tight">AI Kubernetes Agent</h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          Investigate cluster issues with AI-powered root cause analysis
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-8">

        {/* Error banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm rounded-xl px-5 py-4 flex justify-between items-center shadow-lg shadow-red-900/10">
            <span className="font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 ml-4 font-bold text-lg leading-none">×</button>
          </div>
        )}

        {/* Cluster Selection Section */}
        <section className="bg-[#121A2F] rounded-2xl border border-gray-800/80 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Select Cluster</h2>
              <p className="text-xs text-gray-500 mt-0.5">{clusters.length} clusters available</p>
            </div>
          </div>
          
          <div className="bg-[#0B1120] rounded-lg p-3.5 mb-8 border border-gray-800/60 flex items-center gap-3">
            <span className="text-gray-600 text-xs font-medium uppercase tracking-wider">Config Path</span>
            <code className="text-xs text-teal-600 font-mono">~/.kube/config</code>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
            {clusters.length === 0 && (
              <div className="col-span-full py-8 text-center text-gray-500 text-sm">
                No clusters found in kubeconfig.
              </div>
            )}
            {clusters.map(c => {
               const isSelected = selectedCluster === c;
               return (
                 <div 
                   key={c}
                   onClick={() => !isInvestigating && setSelectedCluster(c)}
                   className={`relative p-5 rounded-xl cursor-pointer transition-all duration-200 border group ${
                     isSelected 
                       ? 'bg-[#182845] border-teal-500/50 shadow-lg shadow-teal-900/20' 
                       : 'bg-[#0F172A] border-gray-800 hover:border-gray-600 hover:bg-[#131D32]'
                   } ${isInvestigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                   <div className="flex justify-between items-start mb-4">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${
                        isSelected ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 group-hover:text-gray-300'
                      }`}>
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      {isSelected && (
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-teal-900/40 text-teal-400 px-2.5 py-0.5 rounded border border-teal-800/50">current</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-teal-900/40 text-teal-400 px-2.5 py-0.5 rounded border border-teal-800/50">selected</span>
                        </div>
                      )}
                   </div>
                   <h3 className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>{c}</h3>
                   <p className="text-xs text-gray-500 mt-1.5 truncate">{c}</p>
                 </div>
               )
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-800 flex justify-end">
            <button
              onClick={handleInvestigate}
              disabled={isInvestigating || !selectedCluster}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-gray-500 disabled:border-gray-700 disabled:shadow-none text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-blue-900/30 border border-blue-500 transition-all duration-200 flex items-center gap-2"
            >
              {isInvestigating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Investigating...
                </>
              ) : (
                'Investigate Cluster'
              )}
            </button>
          </div>
        </section>

        {/* Live Progress + Diagnosis */}
        {currentInvestigation && (
          <section className="grid md:grid-cols-2 gap-6 items-stretch">
            {/* Investigation Progress */}
            <div className="bg-[#121A2F] rounded-2xl shadow-xl border border-gray-800 p-6 sm:p-8 flex flex-col h-full">
              <h2 className="text-sm font-bold text-gray-200 border-b border-gray-800 pb-4 mb-6 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Investigation Status
              </h2>
              <ul className="space-y-4 text-sm flex-1">
                {[
                  "Checking Pods",
                  "Reading Logs",
                  "Analyzing Events",
                  "Inspecting Deployments",
                  "Checking Networking",
                  "AI Reasoning"
                ].map((stepName, index, arr) => {
                  const stepNamesFromProgress = progressSteps.map(p => p.step);
                  const isStepInProgress = stepNamesFromProgress.includes(stepName);
                  const latestStepIndex = progressSteps.length > 0 
                    ? arr.indexOf(stepNamesFromProgress[stepNamesFromProgress.length - 1])
                    : -1;
                  
                  let state = 'pending'; // pending, running, completed
                  
                  if (currentInvestigation.status === 'completed') {
                    // For completed investigations, all steps that were reached are "completed"
                    if (isStepInProgress) state = 'completed';
                  } else {
                    if (latestStepIndex === index) {
                      state = 'running';
                    } else if (latestStepIndex > index || isStepInProgress) {
                      state = 'completed';
                    }
                  }

                  return (
                    <li key={stepName} className={`flex items-center gap-4 ${state === 'pending' ? 'text-gray-600' : state === 'running' ? 'text-blue-400' : 'text-gray-300'}`}>
                      {state === 'completed' ? (
                        <div className="w-6 h-6 rounded-full bg-green-900/30 text-green-400 flex items-center justify-center border border-green-800/50 flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      ) : state === 'running' ? (
                        <div className="w-6 h-6 rounded-full bg-blue-900/30 flex items-center justify-center border border-blue-800/50 flex-shrink-0">
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-800/50 text-gray-600 flex items-center justify-center border border-gray-700/50 flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>
                        </div>
                      )}
                      <span className={`font-medium ${state === 'running' ? 'animate-pulse' : ''}`}>{stepName}</span>
                    </li>
                  );
                })}
                
                <li className={`flex items-center gap-4 ${currentInvestigation.status === 'completed' && currentInvestigation.root_cause ? 'text-gray-200' : 'text-gray-600'}`}>
                  {currentInvestigation.status === 'completed' && currentInvestigation.root_cause ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-900/50 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-800/50 text-gray-600 flex items-center justify-center border border-gray-700/50 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>
                    </div>
                  )}
                  <span className={`${currentInvestigation.status === 'completed' && currentInvestigation.root_cause ? 'font-bold' : 'font-medium'}`}>Root Cause Found</span>
                </li>
              </ul>
            </div>

            {/* Diagnosis or Empty State */}
            {currentInvestigation.status === 'completed' && (
              <div className="h-full">
                {currentInvestigation.root_cause ? (
                  <div className="bg-[#121A2F] rounded-2xl shadow-xl border border-red-900/50 p-6 sm:p-8 h-full flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-orange-500"></div>
                    <h2 className="text-sm font-bold text-red-400 border-b border-gray-800 pb-4 mb-6 uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Issue Detected
                    </h2>
                    <div className="space-y-6 text-sm flex-1">
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">Root Cause</span>
                        <p className="text-gray-100 font-semibold text-base leading-snug">{currentInvestigation.root_cause}</p>
                      </div>
                      <div className="bg-[#0B1120] p-4 rounded-xl border border-gray-800">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">Explanation</span>
                        <p className="text-gray-400 leading-relaxed">{currentInvestigation.explanation}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1.5">Suggested Fix</span>
                        <p className="text-gray-200 font-medium leading-relaxed">{currentInvestigation.fix}</p>
                      </div>
                      {currentInvestigation.kubectl_command && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">Command</span>
                          <code className="block bg-[#0B1120] text-teal-400 text-xs p-4 rounded-xl break-all font-mono border border-gray-800 shadow-inner">
                            {currentInvestigation.kubectl_command}
                          </code>
                        </div>
                      )}
                      {currentInvestigation.confidence != null && currentInvestigation.confidence > 0 && (
                        <div className="pt-2">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">AI Confidence</span>
                            <span className="text-blue-400 font-bold text-xs">{currentInvestigation.confidence}%</span>
                          </div>
                          <div className="bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                              style={{ width: `${currentInvestigation.confidence}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#121A2F] border border-green-900/30 rounded-2xl p-8 text-center h-full flex flex-col justify-center items-center shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-400"></div>
                    <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                      <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-green-400 font-bold text-xl mb-2">Cluster is Healthy</h3>
                    <p className="text-gray-400 text-sm max-w-xs leading-relaxed">No critical Kubernetes issues were detected during the automated investigation.</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Investigation History */}
        <section className="bg-[#121A2F] rounded-2xl shadow-xl border border-gray-800 p-6 sm:p-8 mt-4">
          <h2 className="text-sm font-bold text-gray-200 border-b border-gray-800 pb-4 mb-6 uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Previous Investigations
          </h2>
          {investigations.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="text-gray-500 text-sm">No investigations yet. Click "Investigate Cluster" to start your first analysis.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
                    <th className="pb-4 pl-6 sm:pl-2 pr-4">Date</th>
                    <th className="pb-4 pr-4">Root Cause</th>
                    <th className="pb-4 pr-4">Confidence</th>
                    <th className="pb-4 pr-6 sm:pr-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {investigations.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-[#1A243D] cursor-pointer transition-colors group"
                      onClick={() => viewHistoryItem(inv)}
                    >
                      <td className="py-4 pl-6 sm:pl-2 pr-4 text-gray-400 whitespace-nowrap text-xs">
                        {new Date(inv.created_at).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="py-4 pr-4 font-medium text-gray-300 group-hover:text-blue-400 transition-colors">
                        {inv.root_cause || <span className="text-green-500/70 font-normal flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Healthy</span>}
                      </td>
                      <td className="py-4 pr-4 text-gray-500">
                        {inv.confidence != null && inv.confidence > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{inv.confidence}%</span>
                            <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                               <div className="bg-blue-500 h-full" style={{ width: `${inv.confidence}%` }}></div>
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="py-4 pr-6 sm:pr-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded border text-[10px] font-bold tracking-wider uppercase ${
                          inv.status === 'completed'
                            ? inv.root_cause 
                              ? 'bg-red-900/30 text-red-400 border-red-800/50' 
                              : 'bg-green-900/30 text-green-400 border-green-800/50'
                            : inv.status === 'running'
                            ? 'bg-blue-900/30 text-blue-400 border-blue-800/50 animate-pulse'
                            : 'bg-gray-800 text-gray-400 border-gray-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
      
      {/* Custom Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(51, 65, 85, 0.8);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 1);
        }
      `}} />
    </div>
  );
}
