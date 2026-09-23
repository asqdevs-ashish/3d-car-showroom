"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Calendar, Mail, ShieldCheck } from "lucide-react";

import { useSelectedCar, useShowroom } from "@/hooks/useShowroomStore";
import { Modal } from "./Modal";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Shared form atoms                                                   */
/* ------------------------------------------------------------------ */

function Field({
  label,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[8.5px] uppercase tracking-wide2 text-white/35">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className={cn(
          "mt-2 w-full border-b border-white/12 bg-transparent pb-2.5",
          "font-sans text-[13px] text-titanium placeholder:text-white/20",
          "outline-none transition-colors duration-300 focus:border-white/40",
        )}
      />
    </label>
  );
}

/**
 * A confirmation beat after submission. Keeps the modal open and swaps the
 * content rather than firing a toast — the moment deserves the stage.
 */
function Confirmation({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="py-4 text-center"
    >
      <span
        className="mx-auto grid h-11 w-11 place-items-center rounded-full"
        style={{ background: `${accent}1f`, border: `1px solid ${accent}66` }}
      >
        <Check className="h-4 w-4" strokeWidth={2} style={{ color: accent }} />
      </span>
      <h3 className="mt-5 font-display text-lg font-bold uppercase tracking-wide2 text-titanium">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-[34ch] text-[12.5px] leading-relaxed text-white/50">
        {body}
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Test drive                                                          */
/* ------------------------------------------------------------------ */

function TestDriveForm({
  accent,
  carName,
}: {
  accent: string;
  carName: string;
}) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <Confirmation
        accent={accent}
        title="Slot provisionally held"
        body={`A concierge will confirm your ${carName} test drive within one business day. Bring a valid licence and proof of insurance.`}
      />
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2 border-white/8 bg-white/[0.02] px-3.5 py-2.5">
        <Calendar
          className="h-3.5 w-3.5"
          strokeWidth={1.6}
          style={{ color: accent }}
        />
        <span className="font-mono text-[9px] uppercase tracking-wide2 text-white/50">
          Configuring: {carName}
        </span>
      </div>

      <div className="space-y-5">
        <Field label="Full name" placeholder="Alexander Reid" required />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Email"
            type="email"
            placeholder="you@domain.com"
            required
          />
          <Field label="Phone" type="tel" placeholder="+1 (555) 000-0000" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Preferred date" type="date" placeholder="" required />
          <Field label="City" placeholder="Monaco" />
        </div>
      </div>

      <button
        type="submit"
        className="sweep w-full border py-3.5 font-mono text-[10px] uppercase tracking-ultra transition-all duration-300"
        style={{ borderColor: `${accent}88`, color: accent }}
      >
        <span className="relative z-10">Request this slot</span>
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Purchase inquiry                                                    */
/* ------------------------------------------------------------------ */

function InquiryForm({ accent, carName }: { accent: string; carName: string }) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <Confirmation
        accent={accent}
        title="Inquiry received"
        body="Your specification has been passed to the sales director. Expect a private dossier and allocation details shortly."
      />
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
      className="space-y-6"
    >
      <div className="flex items-start gap-2.5 border-white/8 bg-white/[0.02] px-3.5 py-3">
        <ShieldCheck
          className="mt-px h-3.5 w-3.5 shrink-0"
          strokeWidth={1.6}
          style={{ color: accent }}
        />
        <span className="font-mono text-[9px] leading-relaxed tracking-wide2 text-white/50">
          Enquiries are handled confidentially. Allocations for {carName} are
          limited.
        </span>
      </div>

      <div className="space-y-5">
        <Field label="Full name" placeholder="Alexander Reid" required />
        <Field
          label="Email"
          type="email"
          placeholder="you@domain.com"
          required
        />
        <Field
          label="Country of registration"
          placeholder="Switzerland"
          required
        />
        <Field
          label="Notes for the atelier"
          placeholder="Preferred delivery window, bespoke options…"
        />
      </div>

      <button
        type="submit"
        className="sweep w-full border py-3.5 font-mono text-[10px] uppercase tracking-ultra transition-all duration-300"
        style={{ borderColor: `${accent}88`, color: accent }}
      >
        <span className="relative z-10">Submit confidential inquiry</span>
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Exported modals                                                     */
/* ------------------------------------------------------------------ */

export function ShowroomModals() {
  const car = useSelectedCar();
  const modal = useShowroom((s) => s.modal);
  const closeModal = useShowroom((s) => s.closeModal);

  return (
    <AnimatePresence>
      <Modal
        open={modal === "test-drive"}
        onClose={closeModal}
        eyebrow="Private Viewing"
        title="Book a test drive"
        accent={car.signature}
      >
        <TestDriveForm
          accent={car.signature}
          carName={`${car.brand} ${car.name}`}
        />
      </Modal>

      <Modal
        open={modal === "inquire"}
        onClose={closeModal}
        eyebrow="Acquisition"
        title="Inquire purchase"
        accent={car.signature}
      >
        <InquiryForm
          accent={car.signature}
          carName={`${car.brand} ${car.name}`}
        />
      </Modal>
    </AnimatePresence>
  );
}
