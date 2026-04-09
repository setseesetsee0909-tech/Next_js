"use client";

import { useActionState, useEffect, useOptimistic, useRef } from "react";
import { registerTournamentParticipant } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { TOURNAMENT_LABELS, TOURNAMENT_OPTIONS } from "@/lib/constants";
import type { RegistrationInput, RegistrationRecord, SubmissionState } from "@/lib/types";

type OptimisticRegistration = {
  clientId: string;
  registration: RegistrationInput;
  status: "pending";
};

const initialState: SubmissionState = {
  status: "idle",
  message: null,
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RegistrationForm({
  recentRegistrations,
}: {
  recentRegistrations: RegistrationRecord[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(registerTournamentParticipant, initialState);
  const [optimisticItems, addOptimisticItem] = useOptimistic<
    OptimisticRegistration[],
    OptimisticRegistration
  >([], (currentState, newItem) => [newItem, ...currentState]);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Task 1-3 | Optimistic Registration</div>
        <h2 className="section-title" style={{ fontSize: "2rem" }}>
          Parent and player signup with instant feedback
        </h2>
        <p className="muted">
          The form previews the registration immediately, then confirms or rolls
          back after the server action finishes saving to SQLite.
        </p>
      </div>

      {state.message ? (
        <div className={`status-banner ${state.status === "success" ? "success" : "error"}`}>
          {state.message}
        </div>
      ) : null}

      <form
        ref={formRef}
        action={async (formData) => {
          const raw = {
            parentName: String(formData.get("parentName") ?? "").trim(),
            playerName: String(formData.get("playerName") ?? "").trim(),
            email: String(formData.get("email") ?? "").trim().toLowerCase(),
            tournament: String(formData.get("tournament") ?? "valorant") as RegistrationInput["tournament"],
          };

          addOptimisticItem({
            clientId: `${raw.email}-${Date.now()}`,
            registration: raw,
            status: "pending",
          });

          await formAction(formData);
        }}
        className="stack"
      >
        <div className="field">
          <label htmlFor="parentName">Parent Name</label>
          <input id="parentName" name="parentName" placeholder="Anu Batbold" required minLength={2} />
          {state.errors?.parentName ? <div className="small">{state.errors.parentName}</div> : null}
        </div>

        <div className="field">
          <label htmlFor="playerName">Player Name</label>
          <input id="playerName" name="playerName" placeholder="Munkh-Erdene" required minLength={2} />
          {state.errors?.playerName ? <div className="small">{state.errors.playerName}</div> : null}
        </div>

        <div className="field">
          <label htmlFor="email">Contact Email</label>
          <input id="email" name="email" type="email" placeholder="family@example.com" required />
          {state.errors?.email ? <div className="small">{state.errors.email}</div> : null}
        </div>

        <div className="field">
          <label htmlFor="tournament">Tournament</label>
          <select id="tournament" name="tournament" defaultValue="valorant" required>
            {TOURNAMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {state.errors?.tournament ? <div className="small">{state.errors.tournament}</div> : null}
        </div>

        <SubmitButton />
      </form>

      <div className="stack">
        <div className="pill">Instant Preview Feed</div>
        {optimisticItems.map((item) => (
          <article key={item.clientId} className="registration-item pending">
            <strong>{item.registration.playerName || "Pending registration"}</strong>
            <div className="meta-row">
              <span>Parent: {item.registration.parentName || "Waiting for input"}</span>
              <span>{item.registration.email || "Email pending"}</span>
            </div>
            <div className="meta-row">
              <span>{TOURNAMENT_LABELS[item.registration.tournament]}</span>
              <span>Optimistic state: visible before DB save</span>
            </div>
          </article>
        ))}

        {recentRegistrations.length === 0 && optimisticItems.length === 0 ? (
          <div className="empty-state">
            No registrations yet. Submit one and the optimistic card will appear instantly.
          </div>
        ) : null}

        {recentRegistrations.slice(0, 3).map((registration) => (
          <article key={registration.id} className="registration-item">
            <strong>{registration.playerName}</strong>
            <div className="meta-row">
              <span>Parent: {registration.parentName}</span>
              <span>{registration.email}</span>
            </div>
            <div className="meta-row">
              <span>{TOURNAMENT_LABELS[registration.tournament]}</span>
              <span>Saved at {formatTime(registration.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
