
import { Role, User } from './types';

export const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00"
];

export const COURTS = ["Platz 1", "Platz 2"];

export const INITIAL_USERS: Record<string, User> = {
  "sherlock": { id: "sherlock", name: "Sherlock Holmes", role: Role.ADMIN, password: "geheim12" },
  "admin": { id: "admin", name: "Administrator", role: Role.ADMIN, password: "admin" },
  "muellerm": { id: "muellerm", name: "Max Müller", role: Role.USER, password: "muellerm" },
  "schmidta": { id: "schmidta", name: "Anna Schmidt 2", role: Role.USER, password: "schmidta" },
  "martine": { id: "martine", name: "Martin", role: Role.USER, password: "martine" },
  "tinaturner": { id: "tinaturner", name: "Tina Turner", role: Role.USER, password: "tinaturner" },
  "bauerj": { id: "bauerj", name: "Jürgen Bauer", role: Role.USER, password: "bauerj" },
  "weberh": { id: "weberh", name: "Hans Weber", role: Role.USER, password: "weberh" },
  "mayerk": { id: "mayerk", name: "Karl Mayer", role: Role.USER, password: "mayerk" },
  "schulzf": { id: "schulzf", name: "Frank Schulz", role: Role.USER, password: "schulzf" },
  "beckeru": { id: "beckeru", name: "Uwe Becker", role: Role.USER, password: "beckeru" },
  "hoffmanns": { id: "hoffmanns", name: "Stefan Hoffmann", role: Role.USER, password: "hoffmanns" },
  "kochp": { id: "kochp", name: "Peter Koch", role: Role.USER, password: "kochp" },
  "richterd": { id: "richterd", name: "Dieter Richter", role: Role.USER, password: "richterd" },
  "kleina": { id: "kleina", name: "Andreas Klein", role: Role.USER, password: "kleina" },
  "wolffm": { id: "wolffm", name: "Michael Wolff", role: Role.USER, password: "wolffm" },
  "neumannr": { id: "neumannr", name: "Ralf Neumann", role: Role.USER, password: "neumannr" },
  "schwarzt": { id: "schwarzt", name: "Thomas Schwarz", role: Role.USER, password: "schwarzt" },
  "langem": { id: "langem", name: "Markus Lange", role: Role.USER, password: "langem" },
  "hartmannj": { id: "hartmannj", name: "Jens Hartmann", role: Role.USER, password: "hartmannj" }
};
