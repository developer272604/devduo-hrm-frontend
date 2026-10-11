import { Badge } from '../ui';
import { label, statusTone } from '../../lib/peopleApi';

export default function StatusBadge({ status, text }) {
  if (!status) return null;
  return <Badge tone={statusTone(status)}>{text || label(status)}</Badge>;
}
