import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const items = [
  { sku: "A-104", name: "Packing tape", status: "Low stock", supplier: "Northline" },
  { sku: "B-219", name: "Mailer boxes", status: "Healthy", supplier: "BoxWorks" },
  { sku: "C-882", name: "Thermal labels", status: "Reorder soon", supplier: "LabelPro" },
];

function App() {
  return (
    <main>
      <header>
        <h1>Inventory Desk</h1>
        <p>Review low-stock items, supplier status, and reorder decisions.</p>
      </header>
      <section aria-label="Inventory summary" className="summary">
        <strong>3 tracked items</strong>
        <span>1 low-stock alert</span>
      </section>
      <section aria-label="Inventory items" className="items">
        {items.length === 0 ? (
          <p className="empty">No inventory items need attention.</p>
        ) : (
          items.map((item) => (
            <article key={item.sku}>
              <h2>{item.name}</h2>
              <p>{item.status}</p>
              <small>{item.sku} · {item.supplier}</small>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
