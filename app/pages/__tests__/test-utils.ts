const iconStub = { template: "<svg data-icon />" };
const topbarStub = {
  template: '<header class="topbar"><slot /></header>',
  props: ["title", "crumb"],
};
const linkStub = { template: "<a><slot /></a>", props: ["to"] };

export const pageGlobalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      AppTopbar: topbarStub,
      NuxtLink: linkStub,
    },
  },
};
