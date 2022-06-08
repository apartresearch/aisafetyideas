import { createClient } from '@supabase/supabase-js';

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

export const signInWithGoogle = async () => {
  const { user, session, error } = await supabase.auth.signIn({
    provider: 'google',
  });
  $user.update(user);
  return {user, session, error};
}

export async function signout() {
  const { error } = await supabase.auth.signOut();
  location.reload();
}

export async function getUserData() {
  const user = supabase.auth.user()
  return user;
}
