"use client";

import { useEffect, useRef, useState } from "react";
import type { NewProjectInput } from "./add-project-modal";
import { BackButton } from "./back-button";
import { NO_AUTOFILL } from "./no-autofill";
import { slugify } from "./project-factory";
import {
  MANUAL_HOST,
  SSH_CONFIG_HOSTS,
  SshHostPicker,
} from "./ssh-host-picker";
import {
  DialogHeader,
  DialogPanel,
  FIELD_CLASS,
  FieldLabel,
  HelpText,
  PrimaryButton,
  SecondaryButton,
} from "./ui-kit";

// The app's "Add an SSH project" dialog: pick a host from ~/.ssh/config and
// its alias, user and port fill in, or enter one by hand. The project name
// follows the host until it is edited. Its Linux host hint goes back to the
// Server screen, where installing lpm on the server is shown but left to the
// app.
export function SshProjectForm({
  onBack,
  onClose,
  onCreate,
  focusOnOpen,
}: {
  onBack: () => void;
  onClose: () => void;
  onCreate: (input: NewProjectInput) => void;
  focusOnOpen: boolean;
}) {
  const [picked, setPicked] = useState("");
  const [host, setHost] = useState("");
  const [user, setUser] = useState("");
  const [port, setPort] = useState("");
  const [dir, setDir] = useState("");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const hostRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLButtonElement>(null);

  // The dialog takes the keyboard the way the app's does — the picker on
  // arrival, the Host field once the fields appear — but only for a visitor
  // working it, so the tour's clicks never pull the page's focus into it.
  const [focusHost, setFocusHost] = useState(false);
  const fieldsShown = picked !== "";
  useEffect(() => {
    if (focusOnOpen) pickerRef.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);
  useEffect(() => {
    if (fieldsShown && focusHost) hostRef.current?.focus({ preventScroll: true });
  }, [fieldsShown, focusHost]);

  const pick = (value: string, trusted: boolean) => {
    setPicked(value);
    setFocusHost(trusted);
    const match = SSH_CONFIG_HOSTS.find((h) => h.name === value);
    setHost(match?.name ?? "");
    setUser(match?.user ?? "");
    setPort(match?.port ? String(match.port) : "");
  };

  // Editing the host after picking one leaves the picker saying something the
  // form no longer does, so it falls back to manual entry.
  const editHost = (value: string) => {
    setHost(value);
    if (picked !== MANUAL_HOST) setPicked(MANUAL_HOST);
  };

  const suggested = slugify(user && host ? `${user}-${host}` : user || host);
  const projectName = nameEdited ? name : suggested;
  const ready = projectName.trim() !== "" && host.trim() !== "";

  const submit = () => {
    if (!ready) return;
    onCreate({ kind: "ssh", name: projectName.trim(), host: host.trim() });
  };

  return (
    <DialogPanel
      className="relative max-w-[calc(100%-2rem)]"
      aria-label="Add an SSH project"
    >
      <BackButton onClick={onBack} />
      <DialogHeader
        title="Add an SSH project"
        description="Opens one folder on a server as a project. Its terminals, services and actions run over SSH from this Mac, and nothing is installed on the server."
        onClose={onClose}
      />
      <p className="mt-2 text-[11px] leading-relaxed text-[#919191]">
        Keeping several projects on this server?{" "}
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-[#b3b3b3] hover:text-[#e5e5e5] hover:underline"
        >
          Set it up as a Linux host
        </button>{" "}
        instead.
      </p>

      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="mt-4 grid grid-cols-[1fr_120px] gap-3">
          <SshHostPicker
            hosts={SSH_CONFIG_HOSTS}
            picked={picked}
            onPick={pick}
            triggerRef={pickerRef}
          />

          {fieldsShown && (
            <>
              <div className="col-span-2">
                <FieldLabel>Host</FieldLabel>
                <input
                  ref={hostRef}
                  value={host}
                  onChange={(e) => editHost(e.target.value)}
                  placeholder="example.com or 10.0.0.5"
                  {...NO_AUTOFILL}
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <FieldLabel>User</FieldLabel>
                <input
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="root"
                  {...NO_AUTOFILL}
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <FieldLabel>Port</FieldLabel>
                <input
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="22"
                  inputMode="numeric"
                  {...NO_AUTOFILL}
                  className={FIELD_CLASS}
                />
              </div>

              <div className="col-span-2">
                <FieldLabel>
                  Project folder on the server{" "}
                  <span className="font-normal text-[#919191]">(optional)</span>
                </FieldLabel>
                <input
                  value={dir}
                  onChange={(e) => setDir(e.target.value)}
                  placeholder="/var/www/app"
                  {...NO_AUTOFILL}
                  className={FIELD_CLASS}
                />
                <HelpText>
                  Terminals open here; blank means the home folder. For another
                  folder on this server, add another SSH project.
                </HelpText>
              </div>

              <div className="col-span-2">
                <FieldLabel>Project name</FieldLabel>
                <input
                  value={projectName}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameEdited(true);
                  }}
                  placeholder="my-app"
                  {...NO_AUTOFILL}
                  className={FIELD_CLASS}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={!ready} data-tour="ssh-submit">
            Add project
          </PrimaryButton>
        </div>
      </form>
    </DialogPanel>
  );
}
