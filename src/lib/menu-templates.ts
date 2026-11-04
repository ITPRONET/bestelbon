// Voorbeeldmenu's per soort zaak. De uitbater laadt er één, past prijzen aan en schrapt wat hij niet verkoopt.
// Prijzen zijn voorbeeldprijzen in eurocent. Keuzes: "Naam" of ["Naam", meerprijs in cent].
export type TChoice = string | [string, number];
export type TGroup = { name: string; required?: boolean; multi?: boolean; max?: number; choices: TChoice[] };
export type TItem = [name: string, cents: number, description?: string];
export type TCategory = { name: string; groups?: TGroup[]; items: TItem[] };
export type Template = { key: string; label: string; intro: string; categories: TCategory[] };

const BROOD: TGroup = { name: "Broodsoort", required: true, choices: ["Wit", "Bruin", ["Meergranen", 20], ["Waldkorn", 30], ["Ciabatta", 50], "Baguette"] };
const FORMAAT: TGroup = { name: "Formaat", required: true, choices: ["Klein", ["Groot", 150]] };
const SMOS: TGroup = { name: "Smos", choices: [["Smos: sla, tomaat, komkommer, wortel, ei, mayo", 100]] };
const SAUS: TGroup = { name: "Saus", multi: true, max: 2, choices: ["Mayonaise", "Cocktail", "Andalouse", "Samurai", "Tartaar", "Curry", "Mosterd", "Honing-mosterd", "Pesto", "Looksaus", "Martinosaus"] };
const EXTRA: TGroup = { name: "Extra's", multi: true, choices: [["Extra kaas", 80], ["Extra hesp", 80], ["Spek", 100], ["Ei", 60], ["Avocado", 150], ["Augurk", 30], ["Ui", 30]] };
const ZONDER: TGroup = { name: "Zonder", multi: true, choices: ["Zonder ui", "Zonder tomaat", "Zonder sla", "Zonder ei", "Zonder saus"] };
const WARM: TGroup = { name: "Bereiding", choices: [["Getoast / warm", 50]] };

export const TEMPLATES: Template[] = [
  {
    key: "broodjeszaak",
    label: "Broodjeszaak",
    intro: "Koude en warme broodjes met broodsoort, formaat, smos, sauzen, extra's en 'zonder', plus slaatjes, soep, dranken en iets zoets.",
    categories: [
      {
        name: "Koude broodjes", groups: [BROOD, FORMAAT, SMOS, SAUS, EXTRA, ZONDER, WARM],
        items: [
          ["Kaas", 350], ["Hesp", 350], ["Kaas en hesp", 400], ["Préparé", 400, "Huisgemaakte préparé"],
          ["Martino", 450, "Préparé, augurk, ui, ansjovis, martinosaus"], ["Tonijnsla", 420], ["Tonijnsla pikant", 440],
          ["Kip curry", 420], ["Kippenwit", 420], ["Krabsla", 440], ["Eiersla", 380], ["Gerookte zalm", 550],
          ["Brie, honing en walnoot", 480], ["Mozzarella, tomaat en pesto", 480], ["Gezond", 480, "Kaas, hesp, ei en groenten"],
          ["Club", 520, "Kip, spek, ei en groenten"], ["Hummus en groenten", 450, "Vegetarisch"],
        ],
      },
      {
        name: "Warme broodjes", groups: [BROOD, FORMAAT, SAUS, EXTRA, ZONDER],
        items: [["Kipfilet", 520], ["Kip teriyaki", 550], ["Gehaktballetjes in tomatensaus", 550], ["Spek en ei", 500], ["Hamburger", 550], ["Veggie burger", 550]],
      },
      {
        name: "Croques", groups: [{ name: "Extra's", multi: true, choices: [["Extra kaas", 80], ["Ananas", 50], ["Ei", 60]] }],
        items: [["Croque monsieur", 450], ["Croque Hawaï", 500], ["Croque met spek en ei", 550]],
      },
      {
        name: "Slaatjes", groups: [
          { name: "Dressing", required: true, choices: ["Vinaigrette", "Yoghurtdressing", "Caesar", "Honing-mosterd"] },
          { name: "Brood erbij", choices: ["Met stokbrood", "Zonder brood"] },
        ],
        items: [["Slaatje kip", 950], ["Slaatje tonijn", 950], ["Slaatje geitenkaas", 1050, "Met honing en walnoot"], ["Slaatje gerookte zalm", 1100]],
      },
      {
        name: "Soep", groups: [{ name: "Formaat", required: true, choices: ["Klein", ["Groot", 100]] }, { name: "Brood erbij", choices: [["Met brood", 50]] }],
        items: [["Soep van de dag", 350]],
      },
      {
        name: "Dranken",
        items: [["Water plat", 200], ["Water bruisend", 200], ["Coca-Cola", 250], ["Coca-Cola Zero", 250], ["Fanta", 250], ["Ice Tea", 250], ["Fruitsap", 280], ["Koffie", 250], ["Thee", 250]],
      },
      {
        name: "Zoet",
        items: [["Chocomousse", 300], ["Tiramisu", 350], ["Muffin", 280], ["Koek", 150]],
      },
    ],
  },
];

export const templateFor = (type: string | null | undefined) => TEMPLATES.find((t) => t.label.toLowerCase() === (type ?? "").toLowerCase()) ?? null;
