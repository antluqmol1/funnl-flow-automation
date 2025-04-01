
export interface Task {
  id: string;
  title: string;
  type: "call" | "meeting" | "email" | "follow-up" | "other";
  time: string;
  contact: Contact;
  status: "pending" | "completed" | "overdue";
  priority: "high" | "medium" | "low";
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  avatar?: string;
  status: "prospect" | "opportunity" | "customer";
  lastContact?: string;
  value?: number;
  probability?: number;
  tags?: string[];
}

export interface FunnelStage {
  id: string;
  name: string;
  contacts: Contact[];
}

export interface Recording {
  id: string;
  title: string;
  contact: Contact;
  date: string;
  duration: string;
  transcription?: string;
  summary?: string;
  keyPoints?: string[];
  tasks?: Task[];
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastRun?: string;
  tasksCompleted?: number;
}

// Tasks data
export const tasks: Task[] = [
  {
    id: "task1",
    title: "Call with John Smith",
    type: "call",
    time: "09:30",
    contact: {
      id: "contact1",
      name: "John Smith",
      company: "Acme Inc",
      position: "CEO",
      email: "john@acme.com",
      phone: "+1 234 567 8901",
      status: "opportunity",
      value: 75000,
      probability: 70
    },
    status: "pending",
    priority: "high"
  },
  {
    id: "task2",
    title: "Follow up on proposal",
    type: "follow-up",
    time: "11:00",
    contact: {
      id: "contact2",
      name: "Sarah Johnson",
      company: "Tech Solutions",
      position: "CTO",
      email: "sarah@techsolutions.com",
      phone: "+1 234 567 8902",
      status: "opportunity",
      value: 50000,
      probability: 50
    },
    status: "pending",
    priority: "medium"
  },
  {
    id: "task3",
    title: "Send product demo",
    type: "email",
    time: "13:30",
    contact: {
      id: "contact3",
      name: "Michael Brown",
      company: "Global Enterprises",
      position: "COO",
      email: "michael@globalent.com",
      phone: "+1 234 567 8903",
      status: "prospect",
      probability: 30
    },
    status: "pending",
    priority: "medium"
  },
  {
    id: "task4",
    title: "Quarterly review meeting",
    type: "meeting",
    time: "15:00",
    contact: {
      id: "contact4",
      name: "Jessica Williams",
      company: "Innovative Corp",
      position: "Procurement Manager",
      email: "jessica@innovative.com",
      phone: "+1 234 567 8904",
      status: "customer",
      value: 100000
    },
    status: "pending",
    priority: "high"
  },
  {
    id: "task5",
    title: "Update contact information",
    type: "other",
    time: "16:30",
    contact: {
      id: "contact5",
      name: "David Miller",
      company: "Supply Chain Co",
      position: "Logistics Director",
      email: "david@supplychain.com",
      phone: "+1 234 567 8905",
      status: "prospect",
      probability: 20
    },
    status: "overdue",
    priority: "low"
  }
];

// Contacts data
export const contacts: Contact[] = [
  {
    id: "contact1",
    name: "John Smith",
    company: "Acme Inc",
    position: "CEO",
    email: "john@acme.com",
    phone: "+1 234 567 8901",
    status: "opportunity",
    lastContact: "2023-10-10",
    value: 75000,
    probability: 70,
    tags: ["enterprise", "decision-maker"]
  },
  {
    id: "contact2",
    name: "Sarah Johnson",
    company: "Tech Solutions",
    position: "CTO",
    email: "sarah@techsolutions.com",
    phone: "+1 234 567 8902",
    status: "opportunity",
    lastContact: "2023-10-15",
    value: 50000,
    probability: 50,
    tags: ["tech", "influencer"]
  },
  {
    id: "contact3",
    name: "Michael Brown",
    company: "Global Enterprises",
    position: "COO",
    email: "michael@globalent.com",
    phone: "+1 234 567 8903",
    status: "prospect",
    lastContact: "2023-10-05",
    probability: 30,
    tags: ["new-lead", "needs-follow-up"]
  },
  {
    id: "contact4",
    name: "Jessica Williams",
    company: "Innovative Corp",
    position: "Procurement Manager",
    email: "jessica@innovative.com",
    phone: "+1 234 567 8904",
    status: "customer",
    lastContact: "2023-10-20",
    value: 100000,
    tags: ["loyal", "upsell-opportunity"]
  },
  {
    id: "contact5",
    name: "David Miller",
    company: "Supply Chain Co",
    position: "Logistics Director",
    email: "david@supplychain.com",
    phone: "+1 234 567 8905",
    status: "prospect",
    lastContact: "2023-09-28",
    probability: 20,
    tags: ["cold-lead"]
  },
  {
    id: "contact6",
    name: "Emma Wilson",
    company: "Marketing Pros",
    position: "Marketing Director",
    email: "emma@marketingpros.com",
    phone: "+1 234 567 8906",
    status: "opportunity",
    lastContact: "2023-10-12",
    value: 30000,
    probability: 60,
    tags: ["marketing", "mid-sized"]
  },
  {
    id: "contact7",
    name: "Robert Taylor",
    company: "Financial Services Inc",
    position: "CFO",
    email: "robert@financial.com",
    phone: "+1 234 567 8907",
    status: "customer",
    lastContact: "2023-10-18",
    value: 120000,
    tags: ["finance", "enterprise", "expansion"]
  },
  {
    id: "contact8",
    name: "Lisa Anderson",
    company: "Healthcare Solutions",
    position: "Head of IT",
    email: "lisa@healthcare.com",
    phone: "+1 234 567 8908",
    status: "prospect",
    lastContact: "2023-10-08",
    probability: 40,
    tags: ["healthcare", "it-decision-maker"]
  }
];

// Funnel stages data
export const funnelStages: FunnelStage[] = [
  {
    id: "stage1",
    name: "Prospects",
    contacts: contacts.filter(contact => contact.status === "prospect")
  },
  {
    id: "stage2",
    name: "Opportunities",
    contacts: contacts.filter(contact => contact.status === "opportunity")
  },
  {
    id: "stage3",
    name: "Customers",
    contacts: contacts.filter(contact => contact.status === "customer")
  }
];

// Recordings data
export const recordings: Recording[] = [
  {
    id: "rec1",
    title: "Initial Requirements Discussion",
    contact: contacts[0],
    date: "2023-10-15",
    duration: "45:20",
    transcription: "This is a sample transcription of the meeting with John Smith...",
    summary: "John expressed interest in our premium plan and requested a detailed proposal by next week.",
    keyPoints: [
      "Interested in cloud deployment options",
      "Current contract expires in 3 months",
      "Budget approved for Q4",
      "Needs integration with existing CRM"
    ],
    tasks: [
      {
        id: "task6",
        title: "Send premium plan proposal",
        type: "follow-up",
        time: "2023-10-22",
        contact: contacts[0],
        status: "pending",
        priority: "high"
      }
    ]
  },
  {
    id: "rec2",
    title: "Product Demo and Q&A",
    contact: contacts[1],
    date: "2023-10-12",
    duration: "32:15",
    transcription: "This is a sample transcription of the product demo with Sarah Johnson...",
    summary: "Sarah was impressed with the platform's analytics capabilities but had concerns about the onboarding timeline.",
    keyPoints: [
      "Analytics features are a key selling point",
      "Concerns about implementation timeline",
      "Requested reference customers",
      "Interested in custom reporting options"
    ],
    tasks: [
      {
        id: "task7",
        title: "Share case studies of similar implementations",
        type: "email",
        time: "2023-10-14",
        contact: contacts[1],
        status: "completed",
        priority: "medium"
      }
    ]
  },
  {
    id: "rec3",
    title: "Contract Negotiation",
    contact: contacts[6],
    date: "2023-10-18",
    duration: "58:42",
    transcription: "This is a sample transcription of the negotiation with Robert Taylor...",
    summary: "Robert agreed to our payment terms but requested a longer contract period with annual review options.",
    keyPoints: [
      "Accepted pricing structure",
      "Requested 3-year contract",
      "Annual review clause needed",
      "Legal team needs to review final terms"
    ],
    tasks: [
      {
        id: "task8",
        title: "Update contract with new terms",
        type: "other",
        time: "2023-10-20",
        contact: contacts[6],
        status: "pending",
        priority: "high"
      }
    ]
  }
];

// Automations data
export const automations: Automation[] = [
  {
    id: "auto1",
    name: "Follow-up Reminders",
    description: "Automatically create follow-up tasks for prospects after initial contact",
    enabled: true,
    lastRun: "2023-10-20",
    tasksCompleted: 28
  },
  {
    id: "auto2",
    name: "Meeting Summary",
    description: "Generate and send meeting summaries after recordings are transcribed",
    enabled: true,
    lastRun: "2023-10-19",
    tasksCompleted: 12
  },
  {
    id: "auto3",
    name: "Lead Qualification",
    description: "Score and categorize new leads based on interaction data",
    enabled: false,
    lastRun: "2023-10-15",
    tasksCompleted: 45
  },
  {
    id: "auto4",
    name: "Contract Renewal Alerts",
    description: "Send notifications for upcoming contract renewals",
    enabled: true,
    lastRun: "2023-10-18",
    tasksCompleted: 7
  },
  {
    id: "auto5",
    name: "Customer Onboarding",
    description: "Trigger onboarding workflows for new customers",
    enabled: true,
    lastRun: "2023-10-17",
    tasksCompleted: 5
  }
];
