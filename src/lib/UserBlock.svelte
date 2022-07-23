<script>
  import tippy from "sveltejs-tippy";
  export let user;
</script>

<a class="wrapper" href={"/user/" + user.username}>
  <img src={user.image} alt="User profile" class="pb" />
  <div class="flex-vert">
    <h3>{user.username}</h3>
    <div class="tags">
      {#if user.expert}
        <p
          class="indicator Expert"
          use:tippy={{
            content: "Accepted as an expert user who can verify ideas.",
            arrow: true,
            duration: [200, 200],
            delay: [0, 0],
            hideOnClick: true,
          }}
        >
          ⭐ Admin
        </p>
      {/if} 
      {#if user.career_stage}
        <p class={"indicator " + user.career_stage}>{user.career_stage}</p>
      {/if}
    </div>
  </div>
</a>

<style>
  .tags {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    column-gap: 0.3rem;
  }

  .indicator {
    border-radius: var(--border-radius);
    color: var(--font-color-dark);
    padding: 0.2rem 0.4rem;
    font-size: 0.8rem;
    line-height: 0.8rem;
  }

  .Expert {
    background-color: var(--expert);
  }

  .Early {
    background-color: var(--early);
  }

  .Mid {
    background-color: var(--mid);
  }

  .Late {
    background-color: var(--late);
  }

  .Student {
    background-color: var(--student);
  }

  .wrapper {
    margin-bottom: 0.4rem;
    display: flex;
    align-items: center;
    padding: 0.4rem 0.8rem 0rem 0.8rem;
    background-color: var(--light-accent-bg);
    border: 1px solid var(--light-accent-border);
    box-shadow: var(--box-shadow);
    border-radius: 0.3rem;
    flex-grow: 1;
    transition: 0.2s ease-in-out all;
    max-width: 33%;
    color: var(--font-color-light);
  }

  .wrapper:hover {
    border: 1px solid var(--primary-color);
    background-color: var(--primary-color-hover);
    cursor: pointer;
    transform: translate(0, -0.1rem);
    box-shadow: var(--box-shadow-hover);
    text-decoration: none;
  }

  .flex-vert {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    margin-left: 0.4rem;
  }

  h3 {
    font-size: 1rem;
    line-height: 1.2rem;
    margin: 0;
    margin-bottom: 0.1rem;
  }

  .pb {
    border-radius: 50%;
    margin-bottom: 0.4rem;
    height: 2.5rem;
  }

  @media (max-width: 768px) {
    .wrapper {
      max-width: 100%;
    }
  }
</style>
