<script>
  import { supabase } from "$lib/db";
  import { loading, user, ideaCurrent, interests } from "$lib/stores";
  import tippy from "sveltejs-tippy";

  let how = "",
    notifyMe = false;

  const sendInterest = async () => {
    if ($ideaCurrent.interests.find((i) => i.user == $user.id)) {
      $ideaCurrent.interests.splice(
        $ideaCurrent.interests.findIndex(
          (i) => i.user == $user.id && i.idea == $ideaCurrent.id
        ),
        1
      );
      $ideaCurrent.interests_n--;
      await supabase.from("idea_user_interest_relation").delete().match({
        user: $user.id,
        idea: $ideaCurrent.id,
      });
      $ideaCurrent = $ideaCurrent;
    } else {
      $ideaCurrent.interests.push({
        user: $user.id,
        idea: $ideaCurrent.id,
        username: $user.username,
        image: $user.image,
        how,
      });
      $ideaCurrent.interests_n++;
      await supabase.from("idea_user_interest_relation").insert({
        idea: $ideaCurrent.id,
        user: $user.id,
        how,
      });
      $ideaCurrent = $ideaCurrent;
    }
    how = "";
    notifyMe = false;
  };
</script>

{#if !$loading && $user}
  <div class="flex-hori meme">
    <button on:click={() => sendInterest()}>
      <img src="/images/person-outline (2).svg" alt="Help" />

      {$ideaCurrent.interests.find((i) => i.user == $user.id)
        ? "Retract my interest in this project"
        : "I might be interested in helping to realise this project."}
    </button>
    {#if !$ideaCurrent.interests.find((i) => i.user == $user.id)}
      <div class="check">
        <input type="checkbox" bind:value={notifyMe} />
        <!-- svelte-ignore a11y-label-has-associated-control -->
        <label>Notify me when the project starts</label>
      </div>
    {/if}
  </div>
  {#if !$ideaCurrent.interests.find((i) => i.user == $user.id)}
    <textarea
      bind:value={how}
      type="text"
      name="why"
      placeholder="In what ways? E.g. hours & skillset (not required)"
    />
  {/if}
{/if}

<div class="interest-wrapper">
  {#each $ideaCurrent.interests as interest}
    <a
      class="interest"
      href={"/user/" + interest.username}
      use:tippy={{
        content: `<h4 style="font-weight:400;margin:0.2rem 0;">How I might be able to help</h4><p>${interest.how}</p>`,
        allowHTML: true,
        interactive: true,
        delay: [0, 0],
        appendTo: document.body,
      }}
    >
      <img src={interest.image} alt="Help" class="pb" />
      <p>{interest.username} is interested 🡬</p>
    </a>
  {/each}
</div>

<style>
  .interest {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-color-light);
    border-radius: var(--border-radius);
    border: 1px solid var(--primary-color);
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    color: var(--primary-color);
  }

  .interest:hover {
    background-color: var(--primary-color-hover);
    text-decoration: none;
    transform: translate(0, -1px);
  }

  .interest > p {
    margin: 0 0 0 0.1rem;
  }

  .pb {
    border-radius: 100%;
    filter: none;
  }

  label {
    display: block;
    margin: 0;
    font-size: 0.8rem;
    line-height: 1rem;
    font-weight: 400;
  }

  .interest-wrapper {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    margin: 0.3rem 0;
    column-gap: 0.75rem;
    row-gap: 0.5rem;
  }

  .flex-hori {
    display: flex;
    flex-direction: row;
    align-items: center;
    column-gap: 1rem;
    margin: 0.5rem 0 0 0;
  }

  .check {
    display: flex;
    flex-direction: row;
    align-items: center;
    column-gap: 0.5rem;
  }

  button {
    background-color: var(--primary-color-hover);
    color: var(--primary-color);
    border-radius: var(--border-radius);
    border: 1px solid var(--primary-color);
    padding: 0.4rem 0.8rem;
    line-height: 1rem;
    font-size: 0.8rem;
    margin-bottom: 0.3rem;
    font-style: italic;
  }

  button:hover,
  button:focus {
    background-color: var(--primary-color);
    color: white;
  }

  button:hover > img,
  button:focus > img {
    filter: invert(1);
  }

  img {
    width: 1.2rem;
    filter: invert(32%) sepia(86%) saturate(975%) hue-rotate(185deg)
      brightness(93%) contrast(88%);
    margin-right: 0.2rem;
  }

  textarea {
    display: block;
    width: 100%;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--primary-color);
    background-color: var(--light-accent-bg);
    border-radius: var(--border-radius);
    font-size: 0.8rem;
    line-height: 1.2rem;
  }

  input:focus {
    bakground-color: var(--primary-color-hover);
  }
</style>
