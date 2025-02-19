```
{
  userId: string,
  email: string,
  name: string,
  createdAt: timestamp,
  lastLogin: timestamp,
  profile: {
    preferredName: string,
    profilePicture: string,
    bio: string
  },
  settings: {
    isStudent: boolean
  },
  progress: {
    completedNodes: number,
    averageScore: number,
    lastActivity: timestamp,
    brainBucks: number
  },
  extensions: {
    [key: string]: any  // Flexible extension point
  }
}
```