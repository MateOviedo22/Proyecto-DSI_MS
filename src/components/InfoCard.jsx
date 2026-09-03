// src/components/InfoCard.jsx
export default function InfoCard({ title, value, icon }) {
  return (
    <div className="card text-center shadow-sm h-100">
      <div className="card-body">
        {icon && <div className="mb-2 fs-3 text-primary"><i className={`bi ${icon}`}></i></div>}
        <h6 className="card-title text-muted">{title}</h6>
        <h4 className="text-primary fw-bold">{value}</h4>
      </div>
    </div>
  );
}

