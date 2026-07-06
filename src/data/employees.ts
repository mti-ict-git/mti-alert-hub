import type { Employee } from "@/types";
import { DEPARTMENTS, POSITIONS, SECTIONS, SITES } from "./reference";

const firstNames = [
  "Andi", "Budi", "Citra", "Dewi", "Eko", "Fitri", "Gilang", "Hana", "Indra", "Joko",
  "Kartika", "Lukman", "Maya", "Nanda", "Omar", "Putri", "Rizky", "Sinta", "Tomi", "Ulfa",
  "Vino", "Widya", "Xena", "Yusuf", "Zahra", "Arif", "Bella", "Cahyo", "Dini", "Edo",
  "Farah", "Guntur", "Hesti", "Iwan", "Jihan", "Kevin", "Laras", "Mario", "Nia", "Oscar",
];
const lastNames = [
  "Wijaya", "Susanto", "Pratama", "Saputra", "Nugroho", "Hidayat", "Kurniawan", "Santoso",
  "Wibowo", "Setiawan", "Halim", "Tanujaya", "Ramadhan", "Utomo", "Firmansyah",
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

export const employees: Employee[] = firstNames.map((fn, i) => {
  const department = pick(DEPARTMENTS, i);
  const sections = SECTIONS[department];
  const empId = `MTI${String(1001 + i).padStart(5, "0")}`;
  const hasPc = i % 3 !== 0;
  const fieldOfficer = i % 3 === 0 || i % 5 === 0;
  return {
    id: `emp-${i + 1}`,
    employeeId: empId,
    name: `${fn} ${pick(lastNames, i * 3)}`,
    department,
    section: pick(sections, i),
    position: pick(POSITIONS, i),
    site: pick(SITES, i),
    phone: `+62812${String(1000000 + i * 137).slice(0, 8)}`,
    email: `${fn.toLowerCase()}.${pick(lastNames, i * 3).toLowerCase()}@mti.co.id`,
    adUsername: `${fn.toLowerCase()}.${pick(lastNames, i * 3).toLowerCase()}`,
    hasPc,
    fieldOfficer,
    status: i % 17 === 0 ? "Inactive" : "Active",
  };
});
