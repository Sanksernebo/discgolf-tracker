"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ESTONIAN_COUNTIES } from "@/lib/constants";

export type CourseWithHoles = {
  id: string;
  nameEt: string;
  nameEn: string;
  county: string;
  city: string | null;
  latitude: number;
  longitude: number;
  descriptionEt: string | null;
  descriptionEn: string | null;
  holes: { number: number; par: number; distance: number | null }[];
  admins?: { adminId: string }[];
};

type AdminOption = { id: string; email: string; role: string };

type Draft = Omit<CourseWithHoles, "id">;

const empty: Draft = {
  nameEt: "",
  nameEn: "",
  county: "harju",
  city: "",
  latitude: 59.4,
  longitude: 24.75,
  descriptionEt: "",
  descriptionEn: "",
  holes: [{ number: 1, par: 3, distance: null }],
};

export function CourseEditor({
  initial,
  canEditAssignments,
  onClose,
  onSaved,
}: {
  initial: CourseWithHoles | null;
  canEditAssignments: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin");
  const [draft, setDraft] = useState<Draft>(
    initial
      ? {
          nameEt: initial.nameEt,
          nameEn: initial.nameEn,
          county: initial.county,
          city: initial.city ?? "",
          latitude: initial.latitude,
          longitude: initial.longitude,
          descriptionEt: initial.descriptionEt ?? "",
          descriptionEn: initial.descriptionEn ?? "",
          holes: initial.holes.length
            ? initial.holes.map((h) => ({
                number: h.number,
                par: h.par,
                distance: h.distance,
              }))
            : empty.holes,
        }
      : empty,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedAdminIds, setAssignedAdminIds] = useState<string[]>(
    initial?.admins?.map((a) => a.adminId) ?? [],
  );
  const [adminOptions, setAdminOptions] = useState<AdminOption[]>([]);

  useEffect(() => {
    if (!canEditAssignments) return;
    fetch("/api/admin/admins")
      .then((r) => (r.ok ? r.json() : { admins: [] }))
      .then((data) => {
        setAdminOptions(
          (data.admins as AdminOption[]).filter(
            (a) => a.role === "courseAdmin",
          ),
        );
      });
  }, [canEditAssignments]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function updateHole(idx: number, patch: Partial<Draft["holes"][number]>) {
    setDraft((d) => ({
      ...d,
      holes: d.holes.map((h, i) => (i === idx ? { ...h, ...patch } : h)),
    }));
  }

  function addHole() {
    setDraft((d) => ({
      ...d,
      holes: [
        ...d.holes,
        { number: d.holes.length + 1, par: 3, distance: null },
      ],
    }));
  }

  function removeHole(idx: number) {
    setDraft((d) => ({
      ...d,
      holes: d.holes.filter((_, i) => i !== idx),
    }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        ...draft,
        city: draft.city?.trim() || null,
        descriptionEt: draft.descriptionEt?.trim() || null,
        descriptionEn: draft.descriptionEn?.trim() || null,
        holes: draft.holes.map((h) => ({
          number: Number(h.number),
          par: Number(h.par),
          distance:
            h.distance == null || Number.isNaN(Number(h.distance))
              ? null
              : Number(h.distance),
        })),
      };
      if (canEditAssignments) body.assignedAdminIds = assignedAdminIds;
      const url = initial
        ? `/api/admin/courses/${initial.id}`
        : "/api/admin/courses";
      const res = await fetch(url, {
        method: initial ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(JSON.stringify(j.details ?? j.error ?? "error"));
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-2 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-editor-title"
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col gap-3 my-8 max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="course-editor-title" className="text-lg font-semibold">
            {initial ? t("editCourse") : t("addCourse")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="h-9 w-9 grid place-items-center rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("nameEt")}>
            <input
              value={draft.nameEt}
              onChange={(e) => update("nameEt", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t("nameEn")}>
            <input
              value={draft.nameEn}
              onChange={(e) => update("nameEn", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t("county")}>
            <select
              value={draft.county}
              onChange={(e) => update("county", e.target.value)}
              className={inputCls}
            >
              {Object.entries(ESTONIAN_COUNTIES).map(([key, v]) => (
                <option key={key} value={key}>
                  {v.et}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("city")}>
            <input
              value={draft.city ?? ""}
              onChange={(e) => update("city", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t("latitude")}>
            <input
              type="number"
              step="0.0001"
              value={draft.latitude}
              onChange={(e) => update("latitude", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label={t("longitude")}>
            <input
              type="number"
              step="0.0001"
              value={draft.longitude}
              onChange={(e) => update("longitude", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label={t("descriptionEt")}>
            <textarea
              rows={2}
              value={draft.descriptionEt ?? ""}
              onChange={(e) => update("descriptionEt", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t("descriptionEn")}>
            <textarea
              rows={2}
              value={draft.descriptionEn ?? ""}
              onChange={(e) => update("descriptionEn", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {canEditAssignments && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs uppercase text-neutral-500">
              {t("assignedCourses")}
            </legend>
            {adminOptions.length === 0 ? (
              <div className="text-sm text-neutral-500">{t("noUsers")}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 p-2">
                {adminOptions.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 text-sm p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={assignedAdminIds.includes(a.id)}
                      onChange={() =>
                        setAssignedAdminIds((cur) =>
                          cur.includes(a.id)
                            ? cur.filter((x) => x !== a.id)
                            : [...cur, a.id],
                        )
                      }
                      className="h-4 w-4"
                    />
                    <span className="break-all">{a.email}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-neutral-500">
              {t("holes")}
            </div>
            <button
              type="button"
              onClick={addHole}
              className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            >
              + {t("addHole")}
            </button>
          </div>
          <div className="grid grid-cols-[3rem_1fr_1fr_2rem] gap-2 text-xs text-neutral-500 uppercase">
            <div>{t("holeNumber")}</div>
            <div>{t("par")}</div>
            <div>{t("distance")}</div>
            <div></div>
          </div>
          {draft.holes.map((h, i) => (
            <div
              key={i}
              className="grid grid-cols-[3rem_1fr_1fr_2rem] gap-2 items-center"
            >
              <input
                type="number"
                value={h.number}
                onChange={(e) =>
                  updateHole(i, { number: Number(e.target.value) })
                }
                className={inputCls}
                min={1}
              />
              <input
                type="number"
                value={h.par}
                onChange={(e) => updateHole(i, { par: Number(e.target.value) })}
                className={inputCls}
                min={1}
                max={10}
              />
              <input
                type="number"
                value={h.distance ?? ""}
                onChange={(e) =>
                  updateHole(i, {
                    distance:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className={inputCls}
                min={0}
              />
              <button
                type="button"
                onClick={() => removeHole(i)}
                className="text-red-500 hover:text-red-700"
                title={t("removeHole")}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !draft.nameEt || !draft.nameEn}
            className="px-4 py-2 text-sm rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1 text-sm focus:outline-none focus:border-emerald-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
