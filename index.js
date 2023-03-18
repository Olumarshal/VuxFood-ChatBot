const express = require("express");
const session = require("express-session");
const fingerprint2 = require("fingerprintjs2");
const app = express();
const http = require("http");
const server = http.createServer(app);

const PORT = process.env.PORT || 3030;

const sessionMiddleware = session({
  secret: "mysecret",
  resave: false,
  saveUninitialized: true,
});

app.use(sessionMiddleware);

const { Server } = require("socket.io");
const io = new Server(server);

io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res, next);
});

const sessions = {};

// A variable to keep track of the current order
let currentOrder = [];

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  console.log("a user connected");

  const fingerprintPromise = new Promise((resolve) => {
    fingerprint2.get((components) => {
      const values = components.map((component) => component.value);
      const fingerprint = fingerprint2.x64hash128(values.join(""), 31);
      resolve(fingerprint);
    });
  });

  fingerprintPromise.then((fingerprint) => {
    const sessionId = socket.request.session.id;
    const key = `${sessionId}:${fingerprint}`;
    sessions[key] = { socket };

    // send options to customer on connection
    socket.emit("message", "Welcome to our VuxFood chatbot!");
    socket.emit("message", "Please select an option:");
    socket.emit("message", "Select 1 to Place an order");
    socket.emit("message", "Select 99 to checkout order");
    socket.emit("message", "Select 98 to see order history");
    socket.emit("message", "Select 97 to see current order");
    socket.emit("message", "Select 0 to cancel order");

    // listen for incoming messages from customer
    socket.on("message", (msg) => {
      console.log("message: " + msg);

      // initialize flag variable to false
      let mealSelectionInProgress = false;

      // handle customer's message
      switch (msg) {
        case "1":
          // check if meal selection is already in progress
          if (mealSelectionInProgress) {
            socket.emit(
              "message",
              "Sorry, you cannot select a meal at this time. Please try again later."
            );
          } else {
            // set flag variable to true to indicate meal selection is in progress
            mealSelectionInProgress = true;
            socket.emit("message", "Please select a meal to order:");
            socket.emit("message", "1. Burger");
            socket.emit("message", "2. Pizza");
            socket.emit("message", "3. Salad");

            // Listen for incoming messages to handle customer's meal selection
            socket.once("message", (meal) => {
              function askToAddToOrder() {
                socket.emit(
                  "message",
                  "Select 1 to add to your order or 99 to checkout instead"
                );
                socket.once("message", (response) => {
                  switch (response) {
                    case "1":
                      // doing nothing
                      break;
                    case "99":
                      socket.emit(
                        "message",
                        "Your order has been processed. Thank you!"
                      );
                      console.log("Order:", currentOrder);
                      currentOrder = [];
                      break;
                    default:
                      socket.emit(
                        "message",
                        "Sorry, I did not understand your selection. Please try again."
                      );
                      askToAddToOrder();
                      break;
                  }
                });
              }

              switch (meal) {
                case "11":
                  currentOrder.push("Burger");
                  socket.emit(
                    "message",
                    "You have added a burger to your order."
                  );
                  askToAddToOrder();
                  break;
                case "12":
                  currentOrder.push("Pizza");
                  socket.emit(
                    "message",
                    "You have added a Pizza to your order."
                  );
                  askToAddToOrder();
                  break;
                case "13":
                  currentOrder.push("Salad");
                  socket.emit(
                    "message",
                    "You have added a Salad to your order."
                  );
                  askToAddToOrder();
                  break;
                default:
                  socket.emit(
                    "message",
                    "Sorry, I did not understand your selection. Please try again."
                  );
                  break;
              }
              // set flag variable back to false to indicate meal selection is complete
              mealSelectionInProgress = false;
            });
          }
          break;

          function checkoutOrder() {
            //   socket.emit("message", "Your order has been processed. Thank you!");
            console.log("Order:", currentOrder);
            currentOrder = [];
          }

        case "99":
          if (currentOrder.length === 0) {
            socket.emit(
              "message",
              "There are no items in your order! Reply with 1 to place an Order"
            );
          } else {
            checkoutOrder();
          }
          break;
        case "98":
          if (currentOrder.length === 0) {
            socket.emit("message", "There are no items in your order history!");
          } else {
            socket.emit("message", "Here is your order history:");
            socket.emit("message", currentOrder.join(", "));
          }
          break;
        case "97":
          if (currentOrder.length === 0) {
            socket.emit("message", "There are no items in your current order!");
          } else {
            socket.emit("message", "Here is your current order:");
            socket.emit("message", currentOrder.join(", "));
          }
          break;
        case "0":
          socket.emit("message", "Order canceled. Goodbye!");
          // close the connection
          socket.disconnect();
          break;

        // handle other cases here
        // default:
        //   socket.emit(
        //     "message",
        //     "Sorry, I did not understand your message. Please try again."
        //   );
        //   break;
      }
    });
    socket.on("disconnect", () => {
      delete sessions[key];
      console.log("user disconnected");
    });
  });
});

server.listen(process.env.PORT, () => {
  console.log(`server is listening on port ${process.env.PORT}`);
});
