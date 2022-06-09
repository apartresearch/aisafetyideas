import { createClient } from '@supabase/supabase-js';
import { user, users } from '$lib/stores.js';
import { get } from 'svelte/store';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const getUser = async () => {
  const user = await supabase.auth.user();
  if (user) {
    supabase.from('users').where({ id: user.id }).first().then(user => {
      users.set(user);
    });
  } 
  return user;
}

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

export const getIdeas = async() => {
    let [{ data:ideas, error:ideaErr }, {data:likes, error: likeErr}, {data: users, error: userErr}] = await Promise.all(
      [supabase.from("ideas").select(`*`),
      supabase.from("idea_user_likes").select(`*`),
      supabase.from("users").select(`*`)]);
    
    if (ideaErr || likeErr || userErr) {
      console.log(ideaErr, likeErr);
      return [];
    }
    ideas = ideas.map((idea) => ({
      ...idea,
      likes: likes.filter((like) => like.idea === idea.id).length,
      user_liked: likes.find((like) => like.idea === idea.id && supabase.auth.user() && like.user === supabase.auth.user().id),
      username: (users.find((user) => user.id === idea.user) ? users.find((user) => user.id === idea.user).username : null),
    }));
    return ideas;
}

export const getComments = async () => {
  try {
    // Select all columns from the comments table and join with users table
    let { data, error } = await supabase.from("comments").select(
      `*,
      users:author (
        username
      )`,
    );
    console.log(data);
    data.forEach((comment) => {
      comment.replies = data.filter((com) => comment.id === com.reply_to);
    });
    data = data.filter((comment) => comment.reply_to === null || comment.reply_to < 1);
    return data;
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

export const setupIdeas = (ideas,superprojects,categories,problems,categoryRelations,superprojectRelations,problemRelations,ideaRelations,comments) => {
  
  
  ideas.forEach((idea) => {

    idea.comments_n = comments.filter((comment) => comment.idea === idea.id).length;
    
    idea.categories = categoryRelations.filter(
      (relation) => relation.idea === idea.id
    );
    idea.superprojects = superprojectRelations.filter(
      (relation) => relation.idea === idea.id
    );
    idea.problems = problemRelations.filter(
      (relation) => relation.idea === idea.id
    );
    idea.ideas = ideaRelations.filter(
      (relation) => relation.idea === idea.id
    );
    idea.comments = comments.filter(
      (comment) =>
        (comment.reply_to < 1 || !comment.reply_to) &&
        comment.idea === idea.id
    );
    idea.categories.forEach((category) => {
      category.category = categories.find(
        (cat) => cat.id === category.category
      );
    });
    idea.superprojects.forEach((superproject) => {
      superproject.superproject = superprojects.find(
        (sp) => sp.id === superproject.superproject
      );
    });
    idea.problems.forEach((problem) => {
      problem.problem = problems.find((p) => p.title === problem.problem);
    });
    idea.shown = true;
  });

  return ideas;
}

export const getIdea = async (id) => {
  let { data: ideas, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', id);

  return ideas[0];
}

// export const signInWithGoogle = async (redirect = '/') => {
//   const { user: userData, session, error } = await supabase.auth.signIn({
//     provider: 'google', redirect_to: redirect,
//   });
//   userTemp = {};
//   if (!users.find((user) => user.user_metadata === userData.user_metadata)) {
//     userTemp = {...userData, username: userData.user_metadata.name, email: userData.user_metadata.email, expert: false};
//     users.update(val => {
//       val.push(userTemp);
//       return val;
//     });
//   } else {
//     userTemp = users.find((user) => user.user_metadata === userData.user_metadata);
//   }
//   user.set(userTemp);
//   return {user, session, error};
// }

export async function signout() {
  const { error } = await supabase.auth.signOut();
  location.reload();
}

export async function getUserData(userData, id) {
  let userTemp = {};
  if (!get(users).find((user) => user.id === id)) {
    userTemp = {...userData, username: userData.user_metadata.name, email: userData.user_metadata.email, expert: false};
    users.update(val => {
      val.push(userTemp);
      return val;
    });
    console.log('user is being created', get(users));
  } else {
    console.log('user already exists', get(users));
    userTemp = get(users).find((user) => user.id === id);
  }
  return userTemp;
}
