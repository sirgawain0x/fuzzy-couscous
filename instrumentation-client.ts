import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/api/onramp/session-token", method: "POST" },
    { path: "/api/create-order", method: "POST" },
    { path: "/api/init-tableland", method: "POST" },
  ],
});
