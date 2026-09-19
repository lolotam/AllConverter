// Opens Paddle checkout for pricing buttons marked with data-paddle-price.
// Config is rendered by the server only for signed-in users when billing is enabled.
const paddleConfig = document.getElementById("paddle-checkout")?.dataset;

if (paddleConfig && window.Paddle) {
  if (paddleConfig.environment === "sandbox") {
    window.Paddle.Environment.set("sandbox");
  }
  window.Paddle.Initialize({ token: paddleConfig.token });

  for (const button of document.querySelectorAll("[data-paddle-price]")) {
    button.addEventListener("click", () => {
      window.Paddle.Checkout.open({
        items: [{ priceId: button.dataset.paddlePrice, quantity: 1 }],
        customer: { email: paddleConfig.email },
        // Signed so the webhook can trust which account this subscription belongs to
        customData: { user_id: paddleConfig.userId, sig: paddleConfig.sig },
        settings: {
          displayMode: "overlay",
          successUrl: new URL(paddleConfig.successUrl, window.location.origin).href,
        },
      });
    });
  }
}
