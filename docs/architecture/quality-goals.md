# Qualitätsziele

Messbare Ziele aus den Erfolgskriterien der [Spezifikation](../../specs/001-tech-debt-management/spec.md).
Ein Ziel gilt erst als erreicht, wenn der genannte Nachweis grün ist.

| ID   | Qualität                        | Ziel (Messgröße)                                                                                                                         | Quelle             | Nachweis                                                            | Stand                                                        |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| QZ-1 | Leistung (Import)               | Erstimport von bis zu 1.000 Befunden in unter 10 Minuten; ein Wiederholungsimport erzeugt 0 Duplikate                                    | SC-003             | Last- und Idempotenztest im Worker (Aufgabe zu US3 und Abschluss)   | geplant                                                      |
| QZ-2 | Leistung (Oberfläche)           | Register, Filter und Dashboard erscheinen bei bis zu 10.000 Schulden in unter 3 Sekunden                                                 | SC-005             | Performance-Test der API (Aufgabe zu US4)                           | geplant; Index auf Priorität und Status vorhanden            |
| QZ-3 | Konsistenz                      | Dashboard-Kennzahlen stimmen zu 100 % mit den gefilterten Registerdaten überein                                                          | SC-006             | Integrationstest Dashboard gegen Register (Aufgabe zu US4)          | geplant                                                      |
| QZ-4 | Sicherheit, Nachvollziehbarkeit | 100 % der Änderungen an Rollen, Integrationen und Bewertungsmodell stehen im Änderungsprotokoll; kein Zugangsdatum erscheint im Klartext | SC-007             | Audit-Tests und Test auf Klartext in Logs, Antworten und Audit      | Audit für Debts, Produkte und Modell umgesetzt, Rest geplant |
| QZ-5 | Verständlichkeit                | Eine unbeteiligte Person erklärt nach 30 Minuten Lektüre Zweck, Bausteine, Integrationsansatz und die fünf wichtigsten Entscheidungen    | SC-008             | Lesetest mit einer projektfremden Person                            | offen (nach Fertigstellung der Doku)                         |
| QZ-6 | Erweiterbarkeit                 | Eine neue Quelle benötigt keine Änderung am Schuldenmodell und keinem bestehenden Connector                                              | FR-012, Prinzip II | Connector-Schnittstelle, Fixture-Tests je Quelle                    | geplant (US3)                                                |
| QZ-7 | Wartbarkeit der API             | Frontend und Backend können nicht auseinanderlaufen: veraltete OpenAPI-Spezifikation oder generierter Client lässt die CI fehlschlagen   | Prinzip VII        | `pnpm check:generated` in der CI, `scripts/test-check-generated.sh` | erreicht                                                     |
| QZ-8 | Testbarkeit                     | Fachregeln sind ohne Framework testbar; Integrationstests laufen gegen echte PostgreSQL mit den echten Migrationen                       | Prinzip I          | Tests in `packages/domain`, `apps/api/tests`                        | erreicht                                                     |

## Hinweise

- **Messen statt behaupten:** Ziele ohne Nachweis stehen als „geplant“. Sie werden erst auf
  „erreicht“ gesetzt, wenn der Nachweis in der CI läuft.
- **Post-Launch-Kennzahlen** (SC-001, SC-002, SC-004, SC-009) sind Produktmessgrößen aus dem
  Pilotbetrieb und bewusst keine Bauaufgaben; sie stehen in der Spezifikation.
- Änderungen an Zielwerten sind eine Architekturentscheidung und brauchen einen ADR (siehe [Index](adr/README.md)).
