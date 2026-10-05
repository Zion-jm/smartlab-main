import { Prisma } from '@prisma/client';

export type BorrowRequestOrder =
  | Prisma.BorrowRequestOrderByWithRelationInput
  | Prisma.BorrowRequestOrderByWithRelationInput[];

export const borrowRequestInclude = {
  requester: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  },
  program: true,
  room: true,
  usageRoom: true,
  subject: true,
  faculty: {
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  academicYear: true,
  term: true,
  items: {
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.BorrowRequestInclude;

export type BorrowRequestWithRelations = Prisma.BorrowRequestGetPayload<{
  include: typeof borrowRequestInclude;
}>;
