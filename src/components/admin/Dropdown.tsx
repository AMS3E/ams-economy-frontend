"use client";

import Link from "next/link";
import { css } from "@/styled-system/css";
import { ac } from "./tokens";
import { Icon } from "./icons";

export interface Option {
  label: string;
  value: string;
}

// A controlled filter/select dropdown. Open state is owned by the parent so that
// only one menu is open at a time across a toolbar. An invisible fixed backdrop
// closes the menu on any outside click — no document listener, so nothing runs
// in an effect (the repo's React-compiler lint forbids sync setState in effects).
export function Dropdown({
  label,
  hasValue = false,
  open,
  onToggle,
  onClose,
  options,
  selected,
  onSelect,
  minWidth = 180,
  align = "left",
}: {
  label: string;
  hasValue?: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  options: Option[];
  selected?: string;
  onSelect: (value: string) => void;
  minWidth?: number;
  align?: "left" | "right";
}) {
  return (
    <div className={css({ position: "relative" })}>
      <button
        type="button"
        onClick={onToggle}
        className={css({
          height: "36px",
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          borderRadius: "8px",
          fontSize: "13px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "border-color .12s, background .12s",
          _hover: { borderColor: ac.borderStrong },
        })}
        style={{ background: ac.surface, border: `1px solid ${ac.border}`, color: hasValue ? ac.text : ac.muted }}
      >
        {label}
        <Icon name="chevronDown" size={12} style={{ color: ac.muted }} />
      </button>

      {open ? (
        <>
          <div onClick={onClose} className={css({ position: "fixed", inset: 0, zIndex: 10 })} />
          <div
            className={css({ position: "absolute", top: "42px", zIndex: 20, padding: "6px", borderRadius: "10px" })}
            style={{
              minWidth,
              left: align === "left" ? 0 : "auto",
              right: align === "right" ? 0 : "auto",
              background: ac.surface,
              border: `1px solid ${ac.border}`,
              boxShadow: ac.shadowMd,
            }}
          >
            {options.map((o) => (
              <div
                key={o.value}
                onClick={() => {
                  onSelect(o.value);
                  onClose();
                }}
                className={css({ padding: "7px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "13px", whiteSpace: "nowrap", _hover: { background: ac.surfaceHover } })}
                style={{ color: selected === o.value ? ac.text : ac.sub }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// A search input with a leading magnifier. Two modes, because the screens want
// different things: pass `name`/`defaultValue` to let a wrapping <form> drive it
// (uncontrolled) — how Articles, Users and Media push the query into the URL on
// submit — or pass `value`/`onValueChange` for the screens that filter a
// list already in memory and so have nothing to submit (Programs, Menus).
export function SearchInput({
  placeholder,
  width,
  name,
  defaultValue,
  value,
  onValueChange,
}: {
  placeholder: string;
  width?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
}) {
  return (
    <div className={css({ position: "relative", flex: 1 })} style={{ maxWidth: width }}>
      <Icon name="search" size={15} style={{ position: "absolute", left: 12, top: 10, color: ac.faint }} />
      <input
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        placeholder={placeholder}
        type="search"
        className={css({
          width: "100%",
          height: "36px",
          padding: "0 12px 0 36px",
          borderRadius: "8px",
          fontSize: "13.5px",
          _placeholder: { color: "var(--colors-admin-faint)" },
          _focusVisible: { outline: "2px solid var(--colors-admin-focus)", outlineOffset: "2px" },
        })}
        style={{ background: ac.surface, border: `1px solid ${ac.border}`, color: ac.text }}
      />
    </div>
  );
}

// The single red primary button — new article, upload, add user, etc. Pass
// `href` to render it as a navigation link (e.g. into a create flow).
export function PrimaryButton({ label, icon = "plus" as const, href }: { label: string; icon?: "plus" | "upload"; href?: string }) {
  const cls = css({ height: "36px", padding: "0 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", border: "none", color: "#fff", transition: "background .12s, box-shadow .12s", boxShadow: ac.shadowSm, _hover: { background: ac.accentHover } });
  const inner = (
    <>
      <Icon name={icon} size={13} strokeWidth={2} />
      {label}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} style={{ background: ac.accent }}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} style={{ background: ac.accent }}>
      {inner}
    </button>
  );
}
