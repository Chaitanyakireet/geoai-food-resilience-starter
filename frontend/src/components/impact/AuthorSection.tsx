import { author } from "@/lib/author";
import { GitHubIcon, LinkedInIcon, MailIcon, RepoIcon } from "@/components/AuthorLinkIcons";
import styles from "./AuthorSection.module.css";

export function AuthorSection() {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.eyebrow}>Project & Author</div>
      <div className={styles.name}>{author.name}</div>
      <div className={styles.meta}>
        <span>Project: {author.project}</span>
        <span className={styles.sep}>·</span>
        <span>Role: {author.role}</span>
      </div>
      <div className={styles.links}>
        <a href={author.linkedin} target="_blank" rel="noreferrer" className={styles.link}>
          <LinkedInIcon />
          LinkedIn
        </a>
        <a href={author.github} target="_blank" rel="noreferrer" className={styles.link}>
          <GitHubIcon />
          GitHub
        </a>
        <a href={author.projectRepository} target="_blank" rel="noreferrer" className={styles.link}>
          <RepoIcon />
          Project Repository
        </a>
        <a href={`mailto:${author.email}`} className={styles.link}>
          <MailIcon />
          {author.email}
        </a>
      </div>
    </div>
  );
}
