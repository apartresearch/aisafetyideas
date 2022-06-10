import { createClient } from '@supabase/supabase-js';
import { user, users } from '$lib/stores.js';
import { get } from 'svelte/store';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const getTable = async (table_name, grabTitle = true) => {
  try {
    let { data, error } = await supabase.from(table_name).select("*");
    return data.map((elm) => ({
      ...elm,
      value: grabTitle ? elm.title : "",
      label: grabTitle ? elm.title : "",
    }));
  } catch (err) {
    console.log(err);
  }
};

export const deleteComment = async (com_id) => {
  try {
    let { data, error } = await supabase.from("comments").delete().match({id: com_id});
    return data;
  } catch (err) {
    console.log(err);
  }
};

export const addLikeToComment = async (com_id) => {
  try {
    let { data, error } = await supabase.from("comments").update({
      likes: supabase.raw("upvotes + 1"),
    }).match({id: com_id});
    return data;
  } catch (err) {
    console.log(err);
  }
};

export const addLikeToIdea = async (idea_id, remove=false) => {
  try {
    if (!remove) {

      let { data, error } = await supabase.from("idea_user_likes").upsert({
        idea: idea_id,
        user: supabase.auth.user().id,
        size: 1
      });

      
    } else {
      let { data, error } = await supabase.from("idea_user_likes").delete().match({
        idea: idea_id,
        user: supabase.auth.user().id,
      });
    }
    return data;
  } catch (err) {
    console.log(err);
  }
};

export async function signout() {
  const { error } = await supabase.auth.signOut();
  if(error) console.error(error);
}

export async function setUserData(userData, id) {
  let userTemp = {};
  if (!get(users).find((user) => user.id === id)) {
    userTemp = {...userData, username: userData.user_metadata.name, email: userData.user_metadata.email, expert: false, image: userData.user_metadata.picture};
    users.update(val => {
      val.push(userTemp);
      return val;
    });
    user.set(userTemp);
  } else {
    userTemp = get(users).find((user) => user.id === id);
    user.set(userTemp);
  }

  console.log(userTemp, get(user), get(users));
  return userTemp;
}
