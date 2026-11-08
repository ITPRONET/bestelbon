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

const DRANKEN: TCategory = {
  name: "Dranken",
  items: [["Water plat", 200], ["Water bruisend", 200], ["Coca-Cola", 250], ["Coca-Cola Zero", 250], ["Fanta", 250], ["Ice Tea", 250], ["Fruitsap", 280]],
};

// Pizzeria
const PIZZA_FORMAAT: TGroup = { name: "Formaat", required: true, choices: ["Medium (± 30 cm)", ["Large (± 35 cm)", 300]] };
const BODEM: TGroup = { name: "Bodem", required: true, choices: ["Klassiek", "Dun"] };
const TOPPINGS: TGroup = { name: "Extra toppings", multi: true, choices: [["Extra mozzarella", 150], ["Ham", 150], ["Salami", 150], ["Kip", 200], ["Tonijn", 200], ["Ansjovis", 150], ["Champignons", 100], ["Paprika", 100], ["Ui", 80], ["Olijven", 100], ["Ananas", 100], ["Jalapeños", 100], ["Rucola", 100]] };
const PIZZA_ZONDER: TGroup = { name: "Zonder", multi: true, choices: ["Zonder ui", "Zonder olijven", "Zonder champignons", "Zonder paprika"] };

// Pita & kebab
const PITA_BROOD: TGroup = { name: "Brood", required: true, choices: ["Pitabrood", ["Durum (wrap)", 100], ["Turks brood", 50]] };
const PITA_SAUS: TGroup = { name: "Saus", required: true, multi: true, max: 2, choices: ["Looksaus", "Cocktail", "Samurai", "Andalouse", "Algerienne", "Harissa", "Yoghurt-munt", "Mayonaise", "Ketchup", "Geen saus"] };
const PITA_EXTRA: TGroup = { name: "Extra's", multi: true, choices: [["Extra vlees", 250], ["Kaas", 100], ["Feta", 150], ["Halloumi", 200], ["Frietjes erin", 100], ["Jalapeños", 50]] };
const PITA_ZONDER: TGroup = { name: "Zonder", multi: true, choices: ["Zonder ui", "Zonder tomaat", "Zonder sla", "Zonder komkommer", "Zonder rode kool"] };
const PITA_PIKANT: TGroup = { name: "Pikant", choices: ["Een beetje pikant", "Heel pikant"] };


// Frituur
const FRIET_FORMAAT: TGroup = { name: "Formaat", required: true, choices: ["Klein", ["Middel", 60], ["Groot", 130], ["Familie (3-4 pers.)", 450]] };
const FRIET_SAUS: TGroup = { name: "Saus", multi: true, max: 2, choices: [["Mayonaise", 100], ["Stoofvleessaus", 180], ["Andalouse", 100], ["Samurai", 100], ["Cocktail", 100], ["Tartaar", 100], ["Curry ketchup", 100], ["Joppiesaus", 100], ["Bicky-saus", 100], ["Pickles", 100], ["Bearnaise", 100], ["Looksaus", 100]] };
const SNACK_BEREIDING: TGroup = { name: "Bereiding", choices: [["Speciaal (ui, curry, mayo)", 60], "Met ui", "Met curry"] };
const BURGER_EXTRA: TGroup = { name: "Extra's", multi: true, choices: [["Extra kaas", 80], ["Spek", 100], ["Ei", 60], ["Extra burger", 250]] };
const BURGER_ZONDER: TGroup = { name: "Zonder", multi: true, choices: ["Zonder ui", "Zonder augurk", "Zonder sla", "Zonder saus"] };

export const TEMPLATES: Template[] = [
  {
    key: "frituur",
    label: "Frituur",
    intro: "Frieten in vier formaten met sauzen (max. 2), snacks met bereiding, burgers, schotels, losse sauzen, dranken en ijs.",
    categories: [
      {
        name: "Frieten", groups: [FRIET_FORMAAT, FRIET_SAUS],
        items: [["Frieten", 320, "Vers gesneden, in rundvet gebakken"], ["Frieten met stoofvlees", 750], ["Frieten met vol-au-vent", 750], ["Zoete-aardappelfrietjes", 450]],
      },
      {
        name: "Snacks", groups: [SNACK_BEREIDING],
        items: [
          ["Frikandel", 280], ["Bamischijf", 300], ["Kipcorn", 300], ["Viandelle", 300], ["Mexicano", 380], ["Lucifer", 300],
          ["Cervela", 380], ["Curryworst", 300], ["Boulet", 380], ["Bitterballen (6 stuks)", 450], ["Kaaskroketten (2 stuks)", 500],
          ["Garnaalkroketten (2 stuks)", 750], ["Kipnuggets (6 stuks)", 450], ["Mozzarella sticks (5 stuks)", 500], ["Loempia", 380], ["Vegetarische frikandel", 300],
        ],
      },
      {
        name: "Burgers", groups: [BURGER_EXTRA, BURGER_ZONDER],
        items: [["Bicky Burger", 450], ["Bicky Cheese", 500], ["Hamburger", 450], ["Cheeseburger", 500], ["Chickenburger", 500], ["Fishburger", 500], ["Veggie burger", 500]],
      },
      {
        name: "Schotels", groups: [{ name: "Bijgerecht", required: true, choices: ["Frieten", ["Kroketten", 100], "Brood"] }, FRIET_SAUS],
        items: [["Stoofvlees schotel", 1450, "Met slaatje"], ["Vol-au-vent schotel", 1450, "Met slaatje"], ["Balletjes in tomatensaus", 1350], ["Kipschotel", 1350], ["Visschotel", 1500]],
      },
      { name: "Losse sauzen", items: [["Mayonaise", 100], ["Stoofvleessaus", 180], ["Andalouse", 100], ["Samurai", 100], ["Tartaar", 100], ["Curry ketchup", 100], ["Bicky-saus", 100]] },
      DRANKEN,
      { name: "IJs en dessert", items: [["Waterijsje", 200], ["Magnum", 350], ["Dame blanche", 550]] },
    ],
  },
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
      { name: "Dranken", items: [...DRANKEN.items, ["Koffie", 250], ["Thee", 250]] },
      {
        name: "Zoet",
        items: [["Chocomousse", 300], ["Tiramisu", 350], ["Muffin", 280], ["Koek", 150]],
      },
    ],
  },
];

TEMPLATES.push(
  {
    key: "pizzeria",
    label: "Pizzeria",
    intro: "Pizza's met formaat, bodem, extra toppings en 'zonder', plus pasta's, voorgerechten, dranken en desserts.",
    categories: [
      {
        name: "Pizza's", groups: [PIZZA_FORMAAT, BODEM, TOPPINGS, PIZZA_ZONDER],
        items: [
          ["Margherita", 1000, "Tomatensaus, mozzarella, basilicum"], ["Prosciutto", 1200, "Ham"], ["Funghi", 1200, "Champignons"],
          ["Prosciutto e funghi", 1300, "Ham en champignons"], ["Hawaï", 1300, "Ham en ananas"], ["Salami", 1250],
          ["Diavola", 1300, "Pikante salami, peper"], ["Tonno", 1350, "Tonijn en ui"], ["Quattro formaggi", 1400, "Vier kazen"],
          ["Quattro stagioni", 1400, "Ham, champignons, artisjok, olijven"], ["Vegetariana", 1300, "Seizoensgroenten"],
          ["Pollo", 1400, "Kip, paprika, ui"], ["Bolognese", 1300, "Gehakt in tomatensaus"], ["Frutti di mare", 1600, "Zeevruchten"],
          ["Calzone", 1400, "Dichtgevouwen pizza met ham, champignons en kaas"],
        ],
      },
      {
        name: "Pasta's", groups: [{ name: "Extra's", multi: true, choices: [["Extra parmezaan", 100], ["Gegratineerd met kaas", 200]] }],
        items: [["Spaghetti bolognese", 1100], ["Spaghetti carbonara", 1200], ["Penne arrabbiata", 1100, "Pikante tomatensaus"], ["Lasagne", 1250], ["Tagliatelle scampi", 1550], ["Penne pollo", 1300, "Kip in roomsaus"]],
      },
      {
        name: "Voorgerechten",
        items: [["Lookbrood", 450], ["Lookbrood met kaas", 550], ["Bruschetta", 650], ["Kippenvleugeltjes", 700], ["Mozzarella sticks", 650]],
      },
      DRANKEN,
      { name: "Desserts", items: [["Tiramisu", 500], ["Pannacotta", 500], ["Chocomousse", 450]] },
    ],
  },
  {
    key: "pita",
    label: "Pita & kebab",
    intro: "Pita's en durums met brood, saus (max. 2), extra's, 'zonder' en pikant, plus schotels, bijgerechten, dranken en iets zoets.",
    categories: [
      {
        name: "Pita & durum", groups: [PITA_BROOD, PITA_SAUS, PITA_PIKANT, PITA_EXTRA, PITA_ZONDER],
        items: [["Pita kip", 800], ["Pita kalf", 850], ["Pita mix", 900, "Kip en kalf"], ["Pita falafel", 750, "Vegetarisch"], ["Pita halloumi", 850, "Vegetarisch"], ["Pita köfte", 850]],
      },
      {
        name: "Schotels", groups: [
          { name: "Bijgerecht", required: true, choices: ["Frietjes", "Rijst", "Half frietjes, half rijst"] },
          PITA_SAUS, PITA_PIKANT, PITA_ZONDER,
        ],
        items: [["Schotel kip", 1400, "Met sla, groenten en brood"], ["Schotel kalf", 1500, "Met sla, groenten en brood"], ["Schotel mix", 1600], ["Schotel falafel", 1300], ["Schotel köfte", 1500]],
      },
      {
        name: "Bijgerechten", groups: [{ name: "Saus", choices: [["Mayonaise", 90], ["Looksaus", 90], ["Samurai", 90], ["Andalouse", 90]] }],
        items: [["Portie frietjes", 350], ["Lahmacun", 650, "Turkse pizza"], ["Falafel (6 stuks)", 550], ["Slaatje", 450]],
      },
      { name: "Dranken", items: [...DRANKEN.items, ["Ayran", 200]] },
      { name: "Zoet", items: [["Baklava", 400], ["Rijstpudding", 350]] },
    ],
  },
);

export const templateFor = (type: string | null | undefined) => TEMPLATES.find((t) => t.label.toLowerCase() === (type ?? "").toLowerCase()) ?? null;
