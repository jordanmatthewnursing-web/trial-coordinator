import {
  diffStudySnapshots,
  type SourceChange,
  type StudySnapshot,
} from "./snapshot.ts";

export type ReviewStatus =
  | "unreviewed"
  | "appears_met"
  | "possible_mismatch"
  | "follow_up";
export type Evidence = "none" | "referral" | "candidate" | "record";
export type FollowUpQuestion =
  | "candidate_fact"
  | "criterion_wording"
  | "local_protocol";
export type FollowUpOwner = "coordinator" | "study_team" | "investigator";
export type FollowUpAnswer =
  | "pending"
  | "supports"
  | "conflicts"
  | "unclear";
export type FollowUpTask = {
  question: FollowUpQuestion;
  owner: FollowUpOwner;
  dueDate: string;
  answer: FollowUpAnswer;
};
export type Mark = {
  status: ReviewStatus;
  evidence: Evidence;
  reviewedAt?: string;
  followUp?: FollowUpTask;
};
export const questionLabels: Record<FollowUpQuestion, string> = {
  candidate_fact: "Verify synthetic case information",
  criterion_wording: "Clarify criterion wording",
  local_protocol: "Check local protocol requirements",
};
export const ownerLabels: Record<FollowUpOwner, string> = {
  coordinator: "Coordinator",
  study_team: "Study team",
  investigator: "Investigator",
};
export const answerLabels: Record<FollowUpAnswer, string> = {
  pending: "Awaiting answer",
  supports: "No concern found",
  conflicts: "Potential concern found",
  unclear: "Still unclear",
};
export function emptyFollowUpTask(): FollowUpTask {
  return {
    question: "candidate_fact",
    owner: "coordinator",
    dueDate: "",
    answer: "pending",
  };
}
export function updateMark(
  previous: Mark | undefined,
  change: Partial<Mark>,
  reviewedAt: string,
): Mark {
  const next = {
    status: "unreviewed" as ReviewStatus,
    evidence: "none" as Evidence,
    ...previous,
    ...change,
    reviewedAt,
  };
  if (next.status === "follow_up" && !next.followUp) {
    next.followUp = emptyFollowUpTask();
  }
  return next;
}
export type ReviewFacility = { facility: string; place: string };
export function restoreFacility(value: unknown): ReviewFacility | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const item = value as Partial<ReviewFacility>;
  return typeof item.facility === "string" && typeof item.place === "string"
    ? { facility: item.facility, place: item.place } : undefined;
}
export function facilityLabel(value: ReviewFacility | null | undefined): string {
  return value === undefined ? "Not captured in this review" : value === null ? "No facility selected" : `${value.facility} — ${value.place}`;
}
export function captureFacility(value: ReviewFacility | null | undefined): ReviewFacility | null {
  return value ? { facility: value.facility, place: value.place } : null;
}
export type ArchivedReview = {
  selectedFacility?: ReviewFacility | null;
  snapshot: StudySnapshot | null;
  marks: Record<number, Mark>;
  savedAt: string | null;
};
export type DemoCase = {
  selectedFacility?: ReviewFacility | null;
  id: string;
  age: number;
  sex: "FEMALE" | "MALE";
  marks: Record<number, Mark>;
  nextAction: string;
  savedAt: string | null;
  sourcePostedAt: string | null;
  snapshot: StudySnapshot | null;
  archived: ArchivedReview[];
};

export function reviewSourceState(
  demo: DemoCase,
  current: StudySnapshot | null,
  selectedFacility?: ReviewFacility | null,
): {
  legacy: boolean;
  changes: SourceChange[];
  requiresRestart: boolean;
} {
  const hasMarks = Object.values(demo.marks).some(
    (mark) => mark.status !== "unreviewed",
  );
  const legacy = hasMarks && !demo.snapshot;
  const changes =
    demo.snapshot && current ? diffStudySnapshots(demo.snapshot, current) : [];
  if (selectedFacility !== undefined && (demo.snapshot || hasMarks)) {
    const previous = demo.selectedFacility;
    const same = previous !== undefined && (
      previous === null ? selectedFacility === null :
      selectedFacility !== null && previous.facility === selectedFacility.facility && previous.place === selectedFacility.place
    );
    if (!same) changes.push({
      key: "selectedFacility", label: "Selected facility", priority: "review",
      before: facilityLabel(previous), after: facilityLabel(selectedFacility),
    });
  }
  return { legacy, changes, requiresRestart: legacy || changes.length > 0 };
}

export function archiveAndBeginReview(
  demo: DemoCase,
  current: StudySnapshot,
  selectedFacility: ReviewFacility | null = null,
): DemoCase {
  return {
    ...demo,
    archived: [
      ...demo.archived,
      {
        snapshot: demo.snapshot,
        selectedFacility: demo.selectedFacility === undefined ? undefined : captureFacility(demo.selectedFacility),
        marks: { ...demo.marks },
        savedAt: demo.savedAt,
      },
    ],
    marks: {},
    savedAt: null,
    sourcePostedAt: current.updated || null,
    snapshot: current,
    selectedFacility: captureFacility(selectedFacility),
    nextAction: "Complete preliminary review",
  };
}
