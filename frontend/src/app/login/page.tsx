"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { insforge } from '@/lib/insforge';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (showOtp) {
        // Handle OTP Verification
        const { data, error } = await insforge.auth.verifyEmail({
          email,
          otp,
        });
        if (error) throw error;
        
        // Success - user is verified and logged in
        router.push('/dashboard');
      } else if (isSignUp) {
        // Handle Signup
        const { data, error } = await insforge.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        if (data?.requireEmailVerification) {
          setMessage("OTP sent to your email. Please verify.");
          setShowOtp(true);
        } else {
          setMessage("Sign up successful! Please log in.");
          setIsSignUp(false);
        }
      } else {
        // Handle Login
        const { error } = await insforge.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          // Check if error is due to unverified email
          if (error.message.toLowerCase().includes('email not confirmed') || error.message.toLowerCase().includes('verification required')) {
            // Trigger resend and show OTP UI
            await insforge.auth.resendVerificationEmail({ email, redirectTo: window.location.href });
            setMessage("Email verification required. We've sent a new OTP to your email.");
            setShowOtp(true);
            return;
          }
          throw error;
        }
        
        // Navigate to dashboard
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          AI Kubernetes Agent
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {showOtp ? 'Verify your email address' : isSignUp ? 'Create an account to get started' : 'Sign in to access your dashboard'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleAuth}>
            
            {/* Email is always shown (readonly if in OTP mode) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  readOnly={showOtp}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black ${showOtp ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {/* Password input hidden in OTP mode */}
            {!showOtp && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black"
                  />
                </div>
              </div>
            )}

            {/* OTP input shown only in OTP mode */}
            {showOtp && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  6-Digit OTP
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black tracking-widest"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            
            {message && (
              <div className="text-green-600 text-sm">{message}</div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : showOtp ? 'Verify Email' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
            
            {showOtp && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setShowOtp(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel verification
                </button>
              </div>
            )}
          </form>

          {!showOtp && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Or
                  </span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
