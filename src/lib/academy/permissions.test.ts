import { describe, expect, it } from "vitest";

import {
  canReachLesson,
  canReadCourse,
  isPublishedChain,
  type AcademyAccess,
} from "./permissions";

/**
 * Ces trois décisions sont les seules qui séparent une élève du reste du
 * produit. Elles se jouaient jusqu'ici sur la RLS, que l'accès ouvert désarme :
 * elles sont désormais tenues en code, donc éprouvables ici.
 */

const eleve = (patch: Partial<AcademyAccess> = {}): AcademyAccess => ({
  orgId: "org-1",
  userId: "eleve-1",
  isAdmin: false,
  courseIds: ["cours-ugc"],
  isStudent: true,
  ...patch,
});

const owner = (patch: Partial<AcademyAccess> = {}): AcademyAccess =>
  eleve({ isAdmin: true, courseIds: null, isStudent: false, ...patch });

describe("canReadCourse", () => {
  it("ouvre la formation où l'élève est inscrite", () => {
    expect(canReadCourse(eleve(), "cours-ugc")).toBe(true);
  });

  it("ferme la formation voisine, même publiée", () => {
    expect(canReadCourse(eleve(), "cours-smm")).toBe(false);
  });

  it("ouvre tout à l'équipe, dont les formations sans inscription", () => {
    expect(canReadCourse(owner(), "cours-smm")).toBe(true);
  });

  it("ferme tout à une inscription vide plutôt que d'ouvrir par défaut", () => {
    expect(canReadCourse(eleve({ courseIds: [] }), "cours-ugc")).toBe(false);
  });
});

describe("canReachLesson", () => {
  it("accepte une leçon de sa formation, dans son organisation", () => {
    expect(
      canReachLesson(eleve(), { org_id: "org-1", course_id: "cours-ugc" }),
    ).toBe(true);
  });

  it("refuse une leçon d'une formation voisine — l'identifiant vient du navigateur", () => {
    expect(
      canReachLesson(eleve(), { org_id: "org-1", course_id: "cours-smm" }),
    ).toBe(false);
  });

  it("refuse une leçon d'une autre organisation, même formation ouverte", () => {
    expect(
      canReachLesson(eleve(), { org_id: "org-2", course_id: "cours-ugc" }),
    ).toBe(false);
  });
});

describe("isPublishedChain", () => {
  const publie = { lesson: true, module: true, course: true };

  it("laisse passer la chaîne entièrement publiée", () => {
    expect(isPublishedChain(eleve(), publie)).toBe(true);
  });

  it("refuse une leçon publiée dans un module en brouillon", () => {
    expect(isPublishedChain(eleve(), { ...publie, module: false })).toBe(false);
  });

  it("refuse une leçon publiée dans une formation en brouillon", () => {
    expect(isPublishedChain(eleve(), { ...publie, course: false })).toBe(false);
  });

  it("laisse l'owner traverser les brouillons — c'est lui qui les prépare", () => {
    expect(isPublishedChain(owner(), { lesson: false, module: false, course: false })).toBe(
      true,
    );
  });
});
