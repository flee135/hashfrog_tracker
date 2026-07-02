import ootAdapter from "../oot";

// Placeholder Majora's Mask adapter. It exercises the multi-game plumbing
// (routing under /mm, mm-namespaced storage, game selector) by reusing OoT's
// data and logic for now.
// TODO(step 3/4): replace the reused internals with real MM data + logic, add
// public/icons/mm/, and drop the iconGameId override.
const mmAdapter = {
  ...ootAdapter,
  id: "mm",
  displayName: "Majora's Mask Randomizer",
  basePath: "/mm",
  iconGameId: "oot",
};

export default mmAdapter;
