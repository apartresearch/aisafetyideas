import { writable } from "svelte/store";

export const user = writable(false);

export const ideas = writable([]);
export const categories = writable([]);
export const problems = writable([]);
export const comments = writable([]);
export const users = writable([]);
export const idea_likes = writable([]);
export const fundings = writable([]);
export const interests = writable([]);
export const mentorships = writable([]);
export const shownIdeas = writable([]);
export const nodes = writable([]);
export const nodeIdeaRelations = writable([]);

export const categoryRelations = writable([]);
export const problemRelations = writable([]);
export const ideaRelations = writable([]);
export const results = writable([]);

export const loading = writable(true);
export const ideaViewVisible = writable(false);
export const ideaCurrent = writable(undefined);
export const verifications = writable([]);
