import { writable } from "svelte/store";
import { supabase } from "$lib/db";

export const user = writable(supabase.auth.user() || false);
export const isLoggedIn = writable(!!supabase.auth.user());

export const ideas = writable([]);
export const categories = writable([]);
export const problems = writable([]);
export const superprojects = writable([]);
export const comments = writable([]);
