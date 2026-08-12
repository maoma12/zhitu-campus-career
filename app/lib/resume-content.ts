export type ResumeModuleEntry = Record<string, unknown> & { id?: string };

export type ResumeContentShape = {
  experiences: ResumeModuleEntry[];
  educations: ResumeModuleEntry[];
  projects: ResumeModuleEntry[];
  campusExperiences: ResumeModuleEntry[];
  skills: string;
  certificate: string;
  evaluation: string;
  portfolio: string;
  customModules: Array<{ id: string; content: string }>;
  moduleOrder: string[];
  hiddenModules: string[];
};

export function isMeaningfulResumeEntry(entry: object) {
  return Object.entries(entry).some(
    ([key, value]) =>
      key !== "id" && typeof value === "string" && value.trim().length > 0,
  );
}

export function hasMeaningfulModuleContent(
  resume: ResumeContentShape,
  key: string,
) {
  if (key === "basic") return true;
  if (key === "experience") {
    return resume.experiences.some(isMeaningfulResumeEntry);
  }
  if (key === "education") {
    return resume.educations.some(isMeaningfulResumeEntry);
  }
  if (key === "project") {
    return resume.projects.some(isMeaningfulResumeEntry);
  }
  if (key === "campus") {
    return resume.campusExperiences.some(isMeaningfulResumeEntry);
  }
  if (key === "skills") return resume.skills.trim().length > 0;
  if (key === "certificate") return resume.certificate.trim().length > 0;
  if (key === "evaluation") return resume.evaluation.trim().length > 0;
  if (key === "portfolio") return resume.portfolio.trim().length > 0;
  return (
    resume.customModules
      .find((module) => module.id === key)
      ?.content.trim().length ?? 0
  ) > 0;
}

export function isPreviewModuleVisible(
  resume: ResumeContentShape,
  key: string,
) {
  return (
    !resume.hiddenModules.includes(key) &&
    hasMeaningfulModuleContent(resume, key)
  );
}

export function visiblePreviewModuleKeys(resume: ResumeContentShape) {
  return resume.moduleOrder.filter((key) => isPreviewModuleVisible(resume, key));
}

export type WorkspaceActivity = {
  id: string;
  resumeId: string;
  resumeName: string;
  label: string;
  createdAt: string;
};

type ActivityResume = { id: string; name: string };
type ActivitySnapshot = { id: string; label: string; createdAt: string };

export function deriveWorkspaceActivities(
  resumes: readonly ActivityResume[],
  histories: Readonly<Record<string, readonly ActivitySnapshot[]>>,
  limit = 6,
): WorkspaceActivity[] {
  const activities = resumes.flatMap((resume, resumeIndex) =>
    (histories[resume.id] ?? []).map((snapshot, snapshotIndex) => ({
      id: snapshot.id,
      resumeId: resume.id,
      resumeName: resume.name,
      label: snapshot.label,
      createdAt: snapshot.createdAt,
      order: resumeIndex * 100_000 + snapshotIndex,
      timestamp: Date.parse(snapshot.createdAt.replace(/\//g, "-")),
    })),
  );

  return activities
    .sort((left, right) => {
      const leftValid = Number.isFinite(left.timestamp);
      const rightValid = Number.isFinite(right.timestamp);
      if (leftValid && rightValid && left.timestamp !== right.timestamp) {
        return right.timestamp - left.timestamp;
      }
      if (leftValid !== rightValid) return leftValid ? -1 : 1;
      return left.order - right.order;
    })
    .slice(0, Math.max(0, limit))
    .map((activity) => ({
      id: activity.id,
      resumeId: activity.resumeId,
      resumeName: activity.resumeName,
      label: activity.label,
      createdAt: activity.createdAt,
    }));
}
