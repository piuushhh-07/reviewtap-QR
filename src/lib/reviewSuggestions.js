const generalSuggestions = Object.freeze([
  'Overall service experience',
  'Staff friendliness',
  'Helpfulness of the team',
  'Ease of finding what you needed',
  'Quality of the product or service',
  'Range of available options',
  'Value for the price',
  'Clarity of pricing',
  'Time taken to receive service',
  'Accuracy of the order or request',
  'How questions were answered',
  'Communication throughout the visit',
  'Ease of making a booking or purchase',
  'Cleanliness of the premises',
  'Comfort of the space',
  'Atmosphere and overall feel',
  'Accessibility of the location',
  'Convenience of opening hours',
  'Follow-up or after-sales support',
  'What stood out about the experience',
])

const reviewCategories = Object.freeze([
  {
    id: 'cafe-restaurant',
    label: 'Cafe / Restaurant',
    isLegacy: true,
    contextQuestion: 'Was there a particular food or drink you enjoyed?',
    experienceTerm: 'visit',
    suggestions: Object.freeze([
      'Taste and freshness of the food',
      'Quality of coffee, tea, and other drinks',
      'Range of dishes on the menu',
      'Accuracy of the order',
      'Portion sizes',
      'Dietary options on the menu',
      'Visual presentation of dishes',
      'Speed of table service',
      'Time taken for takeaway orders',
      'Packaging for takeaway or delivery',
      'Ease of making a reservation',
      'Seating comfort',
      'Dining area cleanliness',
      'Dining room ambience',
      'Outdoor seating experience',
      'Staff knowledge of the menu',
      'Help with dietary questions',
      'Value of meals and drinks',
      'Dessert selection',
      'Family-friendly facilities',
    ]),
  },
  {
    id: 'cafe-coffee-shop',
    label: 'Café / Coffee Shop',
    contextQuestion: 'How was your coffee or café visit?',
    experienceTerm: 'visit',
    suggestions: Object.freeze([
      'Coffee quality and flavour',
      'Coffee temperature and freshness',
      'Range of espresso and brewed drinks',
      'Tea and other drink options',
      'Milk alternatives and customizations',
      'Barista communication and service',
      'Help choosing a drink',
      'Pastries and baked goods',
      'Freshness of food and snacks',
      'Breakfast and light meal options',
      'Accuracy of the drink order',
      'Time taken to prepare drinks',
      'Drink presentation',
      'Seating comfort and availability',
      'Indoor or outdoor seating',
      'Noise level and atmosphere',
      'Cleanliness of tables and café',
      'Wi-Fi and workspace comfort',
      'Value of drinks and food',
      'Accessibility and opening hours',
    ]),
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    contextQuestion: 'Was there a particular dish you enjoyed?',
    experienceTerm: 'meal',
    suggestions: Object.freeze([
      'Food quality and freshness',
      'Taste and seasoning',
      'Menu variety',
      'Portion size',
      'Food presentation',
      'Time taken for the food to arrive',
      'Order accuracy during the meal',
      'Staff communication and service',
      'Help choosing from the menu',
      'Dietary options and information',
      'Value for the meal price',
      'Dessert and drinks selection',
      'Table comfort and spacing',
      'Dining room atmosphere',
      'Noise level during the meal',
      'Cleanliness of tables and dining area',
      'Ease of booking a table',
      'Takeaway or delivery packaging',
      'Family-friendly options',
      'Accessibility of the restaurant',
    ]),
  },
  {
    id: 'dental-clinic',
    label: 'Dental Clinic',
    contextQuestion: 'Did everything get explained clearly?',
    experienceTerm: 'appointment',
    suggestions: Object.freeze([
      'Ease of booking an appointment',
      'Appointment reminders and communication',
      'Time spent waiting for the appointment',
      'Cleanliness of the treatment rooms',
      'Comfort in the waiting area',
      'How clearly treatment options were explained',
      'Clarity of cost estimates',
      'Dentist communication during the visit',
      'How carefully concerns were heard',
      'Comfort during the examination',
      'Gentleness during treatment',
      'Explanation of aftercare instructions',
      'Support from dental nurses',
      'Help with dental anxiety',
      'Ease of completing patient forms',
      'Privacy during the consultation',
      'Accessibility of the clinic',
      'Availability of appointment times',
      'Coordination between clinic staff',
      'Follow-up after treatment',
    ]),
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    contextQuestion: 'Was it easy to get the help or information you needed?',
    experienceTerm: 'visit',
    suggestions: Object.freeze([
      'Time taken to prepare a prescription',
      'Ease of prescription collection',
      'Availability of prescribed medicines',
      'Staff helpfulness at the counter',
      'Clarity of medicine instructions',
      'Privacy during pharmacist conversations',
      'Help understanding over-the-counter options',
      'Pharmacist availability for questions',
      'Accuracy of prescription preparation',
      'Communication about medicine availability',
      'Ease of prescription refills',
      'Range of health and wellness products',
      'Store organization and layout',
      'Cleanliness of the pharmacy',
      'Queue length and checkout speed',
      'Accessibility of the premises',
      'Convenience of opening hours',
      'Support with insurance or billing questions',
      'Availability of health services',
      'Care taken with prescription handover',
    ]),
  },
  {
    id: 'salon-barber',
    label: 'Salon / Barber',
    isLegacy: true,
    contextQuestion: 'How did you like the service?',
    experienceTerm: 'appointment',
    suggestions: Object.freeze([
      'Ease of booking an appointment',
      'Consultation about the requested style',
      'How well the stylist listened',
      'Cut or styling technique',
      'Attention to detail',
      'Hair wash and rinse experience',
      'Comfort of the salon chair',
      'Cleanliness of tools and stations',
      'Time taken for the appointment',
      'Accuracy of the finished style',
      'Help choosing a suitable style',
      'Color service consultation',
      'Barbering and beard-trim options',
      'Care advice for maintaining the style',
      'Stylist communication during the service',
      'Atmosphere and music',
      'Waiting time after arrival',
      'Range of hair-care products',
      'Value for the service price',
      'Ease of arranging a follow-up visit',
    ]),
  },
  {
    id: 'salon-spa',
    label: 'Salon / Spa',
    contextQuestion: 'How did you like the final styling or treatment?',
    experienceTerm: 'appointment',
    suggestions: Object.freeze([
      'Consultation about the requested style or treatment',
      'How well the stylist or therapist listened',
      'Cut, styling, or treatment quality',
      'Accuracy of final styling or treatment',
      'Attention to service details',
      'Help choosing a suitable option',
      'Comfort during the appointment',
      'Cleanliness of tools and treatment areas',
      'Staff communication during the service',
      'Appointment duration',
      'Appointment availability and booking',
      'Wait after checking in',
      'Range of salon or spa services',
      'Product selection and advice',
      'Care advice after the service',
      'Atmosphere, lighting, and music',
      'Privacy during the treatment',
      'Accessibility of the salon or spa',
      'Value for styling or spa treatment',
      'Ease of scheduling a return appointment',
    ]),
  },
  {
    id: 'gaming-cafe',
    label: 'Gaming Cafe',
    contextQuestion: 'How was your gaming setup?',
    experienceTerm: 'gaming session',
    suggestions: Object.freeze([
      'PC performance during gameplay',
      'Internet stability and latency',
      'Monitor quality and refresh rate',
      'Keyboard and mouse condition',
      'Headset audio and microphone quality',
      'Comfort of gaming chairs',
      'Range of available games',
      'Game installation and update readiness',
      'Ease of booking a gaming session',
      'Accuracy of session timing',
      'Availability of gaming stations',
      'Multiplayer and team-play setup',
      'Tournament or event organization',
      'Pricing of session packages',
      'Clarity of membership benefits',
      'Staff help with technical issues',
      'Cleanliness of desks and peripherals',
      'Power outlet availability',
      'Food and drink options while gaming',
      'Noise levels in the gaming area',
    ]),
  },
  {
    id: 'retail-store',
    label: 'Retail Store',
    contextQuestion: 'Was it easy to find what you were looking for?',
    experienceTerm: 'visit',
    suggestions: Object.freeze([
      'Range of products in stock',
      'Availability of sizes or variants',
      'Ease of finding items in the store',
      'Helpfulness of sales associates',
      'Staff knowledge about products',
      'Time taken at checkout',
      'Queue management at busy times',
      'Store layout and aisle spacing',
      'Clarity of price labels',
      'Ease of comparing product options',
      'Returns and exchanges process',
      'Click-and-collect experience',
      'Online order collection process',
      'Packaging at checkout',
      'Loyalty program benefits',
      'Seasonal or specialty selection',
      'Cleanliness of fitting rooms',
      'Accessibility of store entrances',
      'Value for the price',
      'Availability of customer support',
    ]),
  },
  {
    id: 'hotel-accommodation',
    label: 'Hotel / Accommodation',
    contextQuestion: 'How was your stay?',
    experienceTerm: 'stay',
    suggestions: Object.freeze([
      'Ease of the reservation process',
      'Check-in process and welcome',
      'Helpfulness of reception staff',
      'Room cleanliness on arrival',
      'Bed comfort and linen quality',
      'Room size and layout',
      'Noise levels during the stay',
      'Bathroom condition and amenities',
      'Accuracy of the room description',
      'Wi-Fi availability and reliability',
      'Breakfast choice and service',
      'Restaurant or room-service options',
      'Housekeeping responsiveness',
      'Ease of requesting extra supplies',
      'Clarity of hotel information',
      'Condition of shared facilities',
      'Parking and transport convenience',
      'Check-out process',
      'Accessibility of guest facilities',
      'Value for the stay price',
    ]),
  },
  {
    id: 'gym-fitness',
    label: 'Gym / Fitness',
    contextQuestion: 'How was the equipment and atmosphere?',
    experienceTerm: 'workout',
    suggestions: Object.freeze([
      'Condition of exercise equipment',
      'Availability of popular machines',
      'Variety of strength equipment',
      'Range of cardio machines',
      'Cleanliness of workout areas',
      'Changing room cleanliness',
      'Availability of lockers and showers',
      'Ease of joining or signing up',
      'Clarity of membership options',
      'Class variety and scheduling',
      'Instructor communication in classes',
      'Trainer guidance during sessions',
      'Booking process for classes',
      'Crowding at peak times',
      'Ventilation and temperature',
      'Music and workout atmosphere',
      'Accessibility of the facility',
      'Convenience of opening hours',
      'Support for fitness equipment questions',
      'Value for the membership price',
    ]),
  },
  {
    id: 'electronics-computer-store',
    label: 'Electronics / Computer Store',
    contextQuestion: 'Did you find the advice or service you needed?',
    experienceTerm: 'visit',
    suggestions: Object.freeze([
      'Range of computer components',
      'Availability of requested models',
      'Help comparing technical specifications',
      'Staff knowledge of electronics',
      'Advice on device compatibility',
      'Demonstration units and product testing',
      'Clarity of warranty information',
      'Clarity of repair diagnosis and communication',
      'Time taken for repair service',
      'Updates during a repair',
      'Accuracy of repair or installation',
      'Data handling during device service',
      'Availability of cables and accessories',
      'Checkout and payment options',
      'Online order collection',
      'Returns and exchange support',
      'Packaging for delicate equipment',
      'Store organization by product type',
      'Clarity of technical product labels',
      'Value of products and services',
    ]),
  },
  {
    id: 'automobile-service-centre',
    label: 'Automobile Service Centre',
    contextQuestion: 'How did the service and communication go?',
    experienceTerm: 'service visit',
    suggestions: Object.freeze([
      'Ease of booking a service appointment',
      'Clarity of the initial vehicle inspection',
      'Explanation of recommended work',
      'Clarity of the cost estimate',
      'Communication about service progress',
      'Time taken to complete the service',
      'Accuracy of the completed work',
      'Vehicle condition at collection',
      'Help understanding maintenance options',
      'Staff communication and courtesy',
      'Availability of replacement parts',
      'Ease of dropping off the vehicle',
      'Collection process and timing',
      'Cleanliness of the service centre',
      'Waiting area comfort',
      'Help with follow-up questions',
      'Warranty or service-plan information',
      'Value for the service price',
      'Accessibility of the service centre',
      'Convenience of appointment times',
    ]),
  },
  {
    id: 'other-general-business',
    label: 'Other / General Business',
    contextQuestion: 'What stood out during your experience?',
    experienceTerm: 'experience',
    suggestions: generalSuggestions,
  },
])

const categoriesById = new Map(reviewCategories.map((category) => [category.id, category]))
const generalCategoryId = 'other-general-business'
const ratingPrompts = Object.freeze({
  1: ['What needs attention', 'What could be improved'],
  2: ['Main disappointment', 'What could be improved'],
  3: ['What worked well', 'What could be better'],
  4: ['What went well', 'What could be better'],
  5: ['What stood out about the experience', 'What could be improved'],
})

export function getReviewCategories() {
  return reviewCategories
}

export function getReviewCategory(categoryId) {
  return categoriesById.get(categoryId) ?? categoriesById.get(generalCategoryId)
}

function uniqueTopics(topics) {
  return [...new Map(
    topics
      .filter((topic) => typeof topic === 'string' && topic.trim())
      .map((topic) => [topic.trim().toLocaleLowerCase(), topic.trim()]),
  ).values()]
}

export function getReviewSuggestions(categoryId, rating = null, customTopics = []) {
  const suggestions = uniqueTopics([
    ...getReviewCategory(categoryId).suggestions,
    ...(Array.isArray(customTopics) ? customTopics : []),
  ])
  if (!Object.hasOwn(ratingPrompts, rating)) return suggestions
  return uniqueTopics([
    ...suggestions,
    'What went well',
    'What could be improved',
    ...ratingPrompts[rating],
  ])
}

function hashSeed(value) {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededShuffle(items, seed) {
  let state = hashSeed(seed)
  return items
    .map((item) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return { item, order: state }
    })
    .sort((left, right) => left.order - right.order)
    .map(({ item }) => item)
}

function topicBalanceGroup(topic) {
  if (/staff|service|communication|support|help|guidance|welcome|assistance|barista|therapist|dentist/i.test(topic)) return 'people'
  if (/clean|comfort|atmosphere|ambience|noise|seating|room|environment|accessibility|layout/i.test(topic)) return 'space'
  if (/price|value|cost|payment|membership|pricing|estimate/i.test(topic)) return 'value'
  if (/booking|appointment|waiting|time|speed|reservation|opening hours|availability|collection/i.test(topic)) return 'convenience'
  if (/quality|taste|fresh|condition|accuracy|performance|variety|range|portion|selection/i.test(topic)) return 'quality'
  return 'other'
}

function balancedTopicSelection(topics, count, seed) {
  const groups = new Map()
  for (const topic of topics) {
    const group = topicBalanceGroup(topic)
    groups.set(group, [...(groups.get(group) ?? []), topic])
  }
  const groupOrder = seededShuffle([...groups.keys()], seed)
  const shuffledGroups = new Map(
    groupOrder.map((group) => [
      group,
      seededShuffle(groups.get(group), `${seed}:${group}`),
    ]),
  )
  const selected = []
  for (let index = 0; selected.length < count; index += 1) {
    let addedTopic = false
    for (const group of groupOrder) {
      const topic = shuffledGroups.get(group)[index]
      if (topic) {
        selected.push(topic)
        addedTopic = true
        if (selected.length === count) break
      }
    }
    if (!addedTopic) break
  }
  return selected
}

export function getInitialReviewSuggestions(categoryId, rating = null, visitSeed = '', customTopics = []) {
  const category = getReviewCategory(categoryId)
  const categoryTopics = balancedTopicSelection(
    uniqueTopics([...category.suggestions, ...(Array.isArray(customTopics) ? customTopics : [])]),
    5,
    `${category.id}:${visitSeed}`,
  )
  const ratingPrompt = Object.hasOwn(ratingPrompts, rating)
    ? ratingPrompts[rating][0]
    : null

  return uniqueTopics([...categoryTopics, ...(ratingPrompt ? [ratingPrompt] : [])])
}

export function isValidBusinessCategory(categoryId) {
  return categoriesById.has(categoryId)
}
