/** Native `required` announces the constraint; the star is its visual counterpart. */
export function RequiredMark() {
  return <span aria-hidden="true">*</span>;
}

export function RequiredFieldLegend({ allowDraft = false }: { allowDraft?: boolean }) {
  return (
    <p className="field-hint">
      <span aria-hidden="true">*</span> Required to save.
      {allowDraft
        ? " Fields marked “before review” can stay empty in a draft, but must be filled before you submit."
        : null}
    </p>
  );
}
