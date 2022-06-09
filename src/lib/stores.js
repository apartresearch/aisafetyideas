import { writable } from "svelte/store";
import { asyncable } from 'svelte-asyncable';
import { getIdeas, getTable } from "$lib/db.js";

export const user = writable(false);

export const ideas = writable([]);

export const categories = writable([]);
export const problems = writable([]);

export const superprojects = writable([]);

export const comments = asyncable();
export const users = writable([]);
export const idea_user_likes = writable([]);
export const idea_funding_relation = writable([]);
export const idea_interest_relation = writable([]);
export const idea_mentorship_relation = writable([]);

