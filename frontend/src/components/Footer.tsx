import { author } from "@/lib/author";
import { GitHubIcon, LinkedInIcon, MailIcon, RepoIcon } from "./AuthorLinkIcons";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.line}>
        <span className={styles.project}>GeoAI Food-Resilience Digital Twin</span>
        <span className={styles.sep}>·</span>
        <span>Built by {author.name}</span>
      </div>
      <nav className={styles.links} aria-label="Author and project links">
        <a href={author.linkedin} target="_blank" rel="noreferrer" className={styles.iconLink} title="LinkedIn" aria-label={`${author.name} on LinkedIn`}>
          <LinkedInIcon />
        </a>
        <a href={author.github} target="_blank" rel="noreferrer" className={styles.iconLink} title="GitHub" aria-label={`${author.name} on GitHub`}>
          <GitHubIcon />
        </a>
        <a href={author.projectRepository} target="_blank" rel="noreferrer" className={styles.iconLink} title="Project repository" aria-label="Project repository on GitHub">
          <RepoIcon />
        </a>
        <a href={`mailto:${author.email}`} className={styles.iconLink} title="Email" aria-label={`Email ${author.name}`}>
          <MailIcon />
        </a>
      </nav>
    </footer>
  );
}
