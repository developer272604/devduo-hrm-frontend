import { NavLink } from 'react-router-dom';

export default function SectionNav({ label, items }) {
  if (!items.length) return null;
  return (
    <nav aria-label={label} className="section-nav">
      <ul>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
