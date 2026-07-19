'use client';

import { useRouter } from 'next/navigation';

const TIERS = [
  {
    name: 'Free',
    price: '₹0',
    priceSub: '/ month',
    desc: '1 cluster, up to 10 nodes. Suggest mode only. Every engineer should be able to try Kubric on a real cluster with zero friction.',
    cta: 'Start free',
    features: [
      '50 PR risk assessments / month',
      '7-day incident history',
      'Suggest mode only',
      'Community support',
    ],
  },
  {
    name: 'Starter',
    price: '₹4,999',
    priceSub: '/ month base',
    desc: '+ ₹15 per outcome credit beyond the included pool. For Series A/B teams with real production traffic and no dedicated SRE.',
    cta: 'Start Starter',
    highlight: true,
    features: [
      '2 clusters, up to 25 nodes',
      '500 outcome credits included',
      'Approve mode unlocked',
      'GitHub + Slack + PagerDuty',
    ],
  },
  {
    name: 'Growth',
    price: '₹14,999',
    priceSub: '/ month base',
    desc: '+ ₹12 per outcome credit beyond the included pool (volume discount). For teams where downtime has a real revenue number attached.',
    cta: 'Choose Growth',
    features: [
      '5 clusters, unlimited nodes',
      '2,000 outcome credits included',
      'Auto-fix mode, policy-gated',
      'Priority support + SLA',
    ],
  },
];

export default function PricingSection() {
  const router = useRouter();

  return (
    <div className="pr">
      <div className="pr-grid">
        {TIERS.map((t) => (
          <div key={t.name} className={`pr-card ${t.highlight ? 'is-hi' : ''}`}>
            {t.highlight && <span className="pr-badge">Most popular</span>}
            <div className="pr-name">{t.name}</div>
            <div className="pr-price">
              {t.price} <span className="pr-price-sub">{t.priceSub}</span>
            </div>
            <p className="pr-desc">{t.desc}</p>
            <ul className="pr-feats">
              {t.features.map((f) => (
                <li key={f}>
                  <span className="pr-tick">→</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={t.highlight ? 'pr-btn pr-btn-primary' : 'pr-btn'}
              onClick={() => router.push('/login')}
            >
              {t.cta} <span className="pr-arrow">→</span>
            </button>
          </div>
        ))}
      </div>

      {/* Single minimal footnote */}
      <div className="pr-foot">
        <p className="pr-foot-text">
          Need on-prem, SSO, or a dedicated success engineer? <a href="mailto:hello@kubric.dev">Talk to sales →</a>
        </p>
      </div>

      <style>{`
        .pr { width: 100%; }
        .pr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .pr-card {
          position: relative; display: flex; flex-direction: column; gap: 14px;
          background: #0b100d; border: 0.5px solid rgba(124,255,178,0.14);
          padding: 28px 24px; transition: border-color .3s ease, transform .3s ease;
        }
        .pr-card:hover { border-color: rgba(124,255,178,0.35); }
        .pr-card.is-hi {
          border-color: rgba(124,255,178,0.45);
          background: #0c130f;
        }
        .pr-badge {
          position: absolute; top: -1px; right: 20px; transform: translateY(-50%);
          font-family: var(--font-jetbrains-mono), monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
          color: #05140c; background: #7cffb2; padding: 4px 10px;
        }
        .pr-name {
          font-family: var(--font-jetbrains-mono), monospace; font-size: 11px;
          letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.55);
        }
        .pr-card.is-hi .pr-name { color: #7cffb2; }
        .pr-price { font-size: 32px; font-weight: 700; color: #eef2f5; letter-spacing: -0.01em; line-height: 1; }
        .pr-price-sub { font-family: var(--font-jetbrains-mono), monospace; font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.4); margin-left: 4px; }
        .pr-desc { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.55); margin: 0; }
        .pr-feats { list-style: none; margin: 0; padding: 16px 0 4px; display: flex; flex-direction: column; gap: 10px; border-top: 0.5px solid rgba(255,255,255,0.08); }
        .pr-feats li { display: flex; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.72); line-height: 1.5; }
        .pr-tick { font-family: var(--font-jetbrains-mono), monospace; color: #7cffb2; font-size: 12px; flex-shrink: 0; }
        .pr-btn {
          margin-top: auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 16px; font-family: inherit; font-size: 13.5px; font-weight: 500;
          background: transparent; color: rgba(255,255,255,0.9);
          border: 0.5px solid rgba(255,255,255,0.16); cursor: pointer;
          transition: background .18s ease, border-color .18s ease, color .18s ease;
        }
        .pr-btn:hover { background: rgba(124,255,178,0.06); border-color: rgba(124,255,178,0.35); color: #eef2f5; }
        .pr-btn-primary { background: #7cffb2; color: #05140c; border-color: #7cffb2; font-weight: 600; }
        .pr-btn-primary:hover { background: #9dffc6; color: #05140c; }
        .pr-arrow { transition: transform .2s ease; }
        .pr-btn:hover .pr-arrow { transform: translateX(3px); }

        .pr-foot { margin-top: 22px; text-align: center; }
        .pr-foot-text { font-size: 13px; color: rgba(255,255,255,0.45); margin: 0; }
        .pr-foot-text a { color: #7cffb2; text-decoration: none; font-weight: 500; }
        .pr-foot-text a:hover { text-decoration: underline; }

        @media (max-width: 900px) { .pr-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
