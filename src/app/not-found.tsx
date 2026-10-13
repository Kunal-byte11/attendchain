import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-950 border border-indigo-700/60 text-indigo-400 mb-4 shadow-inner">
          <AlertCircle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          404 — Page Not Found
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          The requested page or resource could not be found on AttendChain.
        </p>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
