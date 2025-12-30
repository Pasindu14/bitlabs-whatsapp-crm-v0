"use client";

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 w-full bg-muted/80 backdrop-blur border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-10 flex items-center justify-center text-xs ">
          <div>© {new Date().getFullYear()} Bitlabs Built with ❤️</div>
        </div>
      </div>
    </footer>
  );
}
