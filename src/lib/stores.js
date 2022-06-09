import { writable } from "svelte/store";
import { asyncable } from 'svelte-asyncable';
import { getIdeas, getTable } from "$lib/db.js";

export const user = writable(false);

export const ideas = asyncable(async () => {
    const ideas = await getIdeas();
    return ideas;
});

export const categories = asyncable();
export const problems = writable([]);

export const superprojects = asyncable(async() => {
    const res = getTable("superprojects");
    return res;
});

export const comments = asyncable();
export const users = writable([]);
export const idea_user_likes = writable([]);
export const idea_funding_relation = writable([]);
export const idea_interest_relation = writable([]);
export const idea_mentorship_relation = writable([]);

