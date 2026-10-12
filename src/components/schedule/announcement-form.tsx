"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  deleteAnnouncement,
  postAnnouncement,
} from "@/app/(admin)/admin/[league]/announcements/actions";
import {
  announcementSchema,
  type AnnouncementInput,
} from "@/lib/validation/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScheduleFeedback, useScheduleMutation } from "./mutation";

export function AnnouncementForm({
  slug,
  divisions,
}: {
  slug: string;
  divisions: readonly { id: string; label: string }[];
}) {
  const t = useTranslations("Announcements");
  const mutation = useScheduleMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", body: "", divisionId: null },
  });
  return (
    <form
      className="space-y-5 rounded-2xl border bg-card p-5"
      noValidate
      onSubmit={handleSubmit((input) =>
        mutation.run(
          () => postAnnouncement(slug, input),
          () => reset(),
        ),
      )}
    >
      <h2 className="font-display text-2xl font-semibold">{t("newPost")}</h2>
      <fieldset disabled={mutation.pending} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="announcement-title" className="font-semibold">
            {t("title")}
          </label>
          <Input
            id="announcement-title"
            maxLength={120}
            {...register("title")}
            aria-invalid={Boolean(errors.title)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="announcement-body" className="font-semibold">
            {t("message")}
          </label>
          <textarea
            id="announcement-body"
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl border-2 bg-card px-4 py-3"
            {...register("body")}
            aria-invalid={Boolean(errors.body)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="announcement-for" className="font-semibold">
            {t("audience")}
          </label>
          <select
            id="announcement-for"
            className="min-h-[52px] w-full rounded-xl border-2 bg-card px-4"
            {...register("divisionId", {
              setValueAs: (value: string | null) => value || null,
            })}
          >
            <option value="">{t("wholeLeague")}</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      {(errors.title || errors.body) && (
        <p role="alert" className="text-sm text-destructive">
          {t("required")}
        </p>
      )}
      <Button disabled={mutation.pending}>
        {t(mutation.pending ? "posting" : "post")}
      </Button>
      <ScheduleFeedback
        result={mutation.result}
        message={(key) => t(key === "saved" ? "posted" : key)}
      />
    </form>
  );
}

export function DeleteAnnouncementButton({
  slug,
  id,
}: {
  slug: string;
  id: string;
}) {
  const t = useTranslations("Announcements");
  const mutation = useScheduleMutation();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        disabled={mutation.pending}
        onClick={() => {
          if (window.confirm(t("deleteConfirm")))
            mutation.run(() => deleteAnnouncement(slug, id));
        }}
      >
        {t("delete")}
      </Button>
      {mutation.result?.error && (
        <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
      )}
    </div>
  );
}
