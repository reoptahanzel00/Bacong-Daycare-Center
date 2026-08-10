'use client';

import React from 'react';

/**
 * Loading skeleton components — used to show animated placeholders
 * while data is being fetched to prevent blank screens.
 */

/** Animated shimmer base class — add to any skeleton element */
const shimmer = 'animate-pulse';

export function TableRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={shimmer}>
          <td>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#EAE6DF] shrink-0" />
              <div className="space-y-1.5">
                <div className="h-3 w-28 bg-[#EAE6DF] rounded-full" />
                <div className="h-2 w-18 bg-[#F0EDE8] rounded-full" />
              </div>
            </div>
          </td>
          <td><div className="h-3 w-20 bg-[#EAE6DF] rounded-full" /></td>
          <td><div className="h-3 w-16 bg-[#EAE6DF] rounded-full" /></td>
          <td><div className="h-6 w-20 bg-[#EAE6DF] rounded-full" /></td>
        </tr>
      ))}
    </>
  );
}

export function PupilCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${shimmer} p-4 rounded-3xl border border-[#E6E4DF] bg-white space-y-3`}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAE6DF] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-5 w-20 bg-[#EAE6DF] rounded-full" />
                <div className="h-5 w-16 bg-[#EAE6DF] rounded-full" />
              </div>
              <div className="h-3 w-32 bg-[#EAE6DF] rounded-full" />
              <div className="h-2 w-24 bg-[#F0EDE8] rounded-full" />
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[#FAF8F5] space-y-1.5">
            <div className="h-2 w-full bg-[#EAE6DF] rounded-full" />
            <div className="h-2 w-3/4 bg-[#EAE6DF] rounded-full" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#E6E4DF]">
            <div className="h-7 w-24 bg-[#EAE6DF] rounded-full" />
            <div className="flex gap-1.5">
              <div className="h-8 w-8 bg-[#EAE6DF] rounded-xl" />
              <div className="h-8 w-8 bg-[#EAE6DF] rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`${shimmer} card flex items-center gap-3.5 p-4 bg-white`}>
          <div className="w-12 h-12 rounded-2xl bg-[#EAE6DF] shrink-0" />
          <div className="space-y-2">
            <div className="h-6 w-10 bg-[#EAE6DF] rounded-full" />
            <div className="h-2 w-24 bg-[#F0EDE8] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={`${shimmer} p-3 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] flex items-center gap-3`}>
          <div className="w-8 h-8 rounded-xl bg-[#EAE6DF] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 bg-[#EAE6DF] rounded-full" />
            <div className="h-2 w-full bg-[#F0EDE8] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
