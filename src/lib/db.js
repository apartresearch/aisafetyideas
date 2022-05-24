import { createClient } from '@supabase/supabase-js'

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

export const setupIdeas = (ideas,superprojects,categories,problems,categoryRelations,superprojectRelations,problemRelations,ideaRelations,comments) => {
  
  ideas.forEach((idea) => {
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
    idea.comments.forEach((comment) => {
      comment.replies = comments.filter((com) => comment.id === com.reply_to);
    });
    idea.categories.forEach((category) => {
      category.category = categories.find(
        (cat) => cat.id === category.category
      );
    });
    idea.comments_n = 0;
    idea.comments.forEach((comment) => {
      idea.comments_n += 1;
      idea.comments_n += comment.replies.length;
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

  console.log(ideas, error);
  return ideas[0];
}