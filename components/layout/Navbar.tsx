"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Logomark } from "@/components/shared/Logomark";
import { navLinks, siteConfig } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useAuth, UserButton } from "@clerk/nextjs";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 group" aria-label={`${siteConfig.name} home`}>
      <span className="flex h-10 w-10 items-center justify-center transition-transform duration-300 group-hover:scale-105">
        <Image src="/logo.jpg" alt="Quinn Luxurious Logo" width={40} height={40} className="rounded-sm object-cover" />
      </span>
      <span className="font-display text-xl sm:text-2xl font-semibold tracking-wide text-ink pt-1">
        {siteConfig.name}
      </span>
    </Link>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { isSignedIn } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        scrolled
          ? "bg-paper/90 backdrop-blur-md shadow-soft border-b border-gold/10"
          : "bg-transparent"
      )}
    >
      <div className="container flex h-20 items-center justify-between">
        <Logo />

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative text-sm font-medium tracking-wide transition-colors hover:text-gold-dark",
                  active ? "text-gold-dark" : "text-ink/80"
                )}
              >
                {link.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-2 left-0 right-0 h-[2px] bg-gold"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isSignedIn ? (
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link label="My Appointments" href="/account" labelIcon={<User className="h-4 w-4" />} />
              </UserButton.MenuItems>
            </UserButton>
          ) : (
            <Link
              href="/login"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink/80 hover:bg-cream hover:text-gold-dark transition-colors"
              aria-label="Sign in"
            >
              <User className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          )}
          <Button asChild>
            <Link href="/appointment">Book Now</Link>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <button
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-cream transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent>
            <div className="mt-4 mb-10">
              <Logo />
            </div>
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <SheetClose asChild key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "rounded-xl px-4 py-3 text-base font-medium transition-colors hover:bg-cream hover:text-gold-dark",
                      pathname === link.href ? "text-gold-dark bg-cream" : "text-ink"
                    )}
                  >
                    {link.label}
                  </Link>
                </SheetClose>
              ))}
              <SheetClose asChild>
                <Link
                  href={isSignedIn ? "/account" : "/login"}
                  className={cn(
                    "rounded-xl px-4 py-3 text-base font-medium transition-colors hover:bg-cream hover:text-gold-dark",
                    pathname === "/account" || pathname === "/login" ? "text-gold-dark bg-cream" : "text-ink"
                  )}
                >
                  {isSignedIn ? "My Account" : "Sign In"}
                </Link>
              </SheetClose>
            </nav>
            <div className="mt-8">
              <SheetClose asChild>
                <Button asChild className="w-full">
                  <Link href="/appointment">Book Now</Link>
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </motion.header>
  );
}
