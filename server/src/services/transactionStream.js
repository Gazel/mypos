const clients = new Set();

export function addTransactionStreamClient(req, res) {
  const client = { res, user: req.user };
  clients.add(client);

  res.write("event: connected\ndata: {}\n\n");

  req.on("close", () => {
    clients.delete(client);
  });
}

export function broadcastTransactionCreated(transaction) {
  const payload = JSON.stringify(transaction);

  for (const client of clients) {
    if (
      client.user.role === "cashier" &&
      (transaction.status || "SUCCESS") !== "SUCCESS"
    ) {
      continue;
    }

    client.res.write(`event: transaction-created\ndata: ${payload}\n\n`);
  }
}
