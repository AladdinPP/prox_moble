import React from "react";

export function Splash() {
  return (
    <div className="fixed inset-0 bg-prox flex items-center justify-center">
      <div className="px-6 text-center">
        <img
          src="/Icon-01.png"
          alt="Prox Logo"
          className="w-32 h-32 mx-auto object-contain"
          draggable={false}
        />
        <p className="mt-8 text-white/90 text-2xl font-secondary">
          Save hundreds every month on groceries.
        </p>
      </div>
    </div>
  );
}
