import React from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="row">
      <div className="column">
        <h2>404 Not Found</h2>
        <Link to="/">На Главную</Link>
      </div>
    </div>
  );
}
