import Link from "next/link";
import { legalDocuments, type LegalDocumentContent } from "@/lib/legal/documents";
import { LEGAL_SUPPORT_EMAIL } from "@/lib/legal/versions";
import styles from "./legal.module.css";

/** Public, versioned wording shared by account and booking acceptance links. */
export function LegalDocument({
  document,
  archived = false,
}: {
  document: LegalDocumentContent;
  archived?: boolean;
}) {
  return (
    <main id="main-content" className={`container ${styles.main}`}>
      <header className={styles.heading}>
        <span className="eyebrow">Qualia policies</span>
        <h1>{document.title}</h1>
        <p className="muted">Effective {document.effectiveDate}</p>
        <p className={styles.version}>
          <Link href={`/legal/${document.version}`}>Version {document.version}</Link>
        </p>
        {archived ? (
          <p className="muted">
            A preserved copy of this document.{" "}
            <Link href={document.href}>View the current policy.</Link>
          </p>
        ) : null}
      </header>
      <nav className={styles.navigation} aria-label="Qualia policies">
        {legalDocuments.map((policy) => (
          <Link
            href={policy.href}
            key={policy.href}
            aria-current={policy.href === document.href ? "page" : undefined}
          >
            {policy.title}
          </Link>
        ))}
      </nav>
      <article className={styles.content}>
        {document.sections.map((section, index) => (
          <section key={section.heading ?? index}>
            {section.heading ? <h2>{section.heading}</h2> : null}
            {section.blocks.map((block, blockIndex) =>
              block.type === "paragraph" ? (
                <p key={blockIndex}>{block.text}</p>
              ) : (
                <ul key={blockIndex}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </article>
      <aside className={styles.contact} aria-label="Policy contact">
        <h2>Questions or a request?</h2>
        <p>
          Email <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`}>{LEGAL_SUPPORT_EMAIL}</a> or use our{" "}
          <Link href="/contact">contact form</Link>. In an emergency, contact local emergency
          services first.
        </p>
        <address>
          Qualia · Axel Paulhiac
          <br />
          1000 Brickell Avenue, Suite #715 PMB 787
          <br />
          Miami, FL 33131, United States
        </address>
      </aside>
    </main>
  );
}
