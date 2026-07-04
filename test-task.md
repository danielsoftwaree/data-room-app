## **Goal**

This take-home project is designed to evaluate your ability to tackle real-world challenges similar to those you would encounter in our engineering roles. Beyond gauging your technical skills, we aim to understand your problem-solving approach, creativity, clarity of documentation, and your ability to articulate your decisions. The solution method for this project is intentionally left open-ended, to give you the room to showcase these facets.

**Estimated Time**: You are expected to spend around 4-6 hours, but feel free to go over as you wish.

## **Introduction**

Acme Corp. is negotiating a multi-billion dollar acquisition and wants to conduct due diligence by placing all the relevant documents in a virtual Data Room. A [<u>Data Room</u>](https://www.indeed.com/career-advice/career-development/what-is-data-room) is an organized repository for securely storing and distributing documents. You can take inspiration from Google Drive, Dropbox, Box, etc., for UI/UX where the Data Room is the top-level folder or drive.

Our goal is to develop a Data Room Software MVP that works well out of the box. We ask that you optimize for (in this order):

- User experience and functionality - make sure UX flows are intuitive and easy to use, handle edge cases and error states

- Design and polish - make sure the design looks clean, don’t include unimplemented features

- Code quality and readability

## **Instructions**

### **Technical Requirements**

- Build a Dataroom frontend single page application,

  - you can use any react based frameworks (we use React / TypeScript / Tailwind/ Shadcn for our client)

  - Allow users to create Datarooms and upload files

  - If you’re using React, checkout the simple React Setup Guide at the bottom of this page [<u>Frontend Takehome</u>](https://docs.google.com/document/d/1tk6kdmr6YLSGWXOMH0evcllEPueaBs0_hHXMBZ4IfMM/edit?tab=t.0#heading=h.k9orgjy684ub)

- You can also use off-the-shelf boilerplates code (e.g., create-react-app) or even use AI to write code.

- Your solution should work end to end

- You can mock your CRUD data being sent to and from the server in json, indexDB or something else

While designing your solution, think of

- Good data structures to store metadata and state, designed to support functional requirements

- Edge cases, ex: uploading files with the same name etc

- Granular react components

### **Functional Requirements**

Below is the main CRUD functionality you should build for

**Folders:**

- Create a folder and can nest folders in another folder

- View folders and their contents, this includes nested files and folders

- Update the folder name

- Delete a folder and its nested folders and files

**Files:**

- Upload a file, you can support only pdf files for now and can store it in browser memory (mock)

- View file in UI

- Update a files name

- Delete a file

**(Optional) For extra credit:**

We ask that you time-box your solution and only attempt the below if you have time remaining

- You can deploy both frontend and backend to the hosting platform of your choice, store the files in blob storage, thereby making this app publicly accessible.

- You can add an authentication layer using social auth or user/password

- You can add search and filtering features that allows users to search for documents based on contents or file names.

### **Deliverables**

1.  Code files (required): A github repo with your code and a README discussing your **design decisions and clear setup instructions\**

2.  Hosted URL: we recommend using Vercel for this