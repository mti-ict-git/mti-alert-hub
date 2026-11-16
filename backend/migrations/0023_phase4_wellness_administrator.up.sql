alter table public.users drop constraint users_role_type_check;
alter table public.users add constraint users_role_type_check check (
  role_type in ('CentralAdmin', 'LocalOperator', 'ManagementViewer', 'ITOperator',
    'CommunicationOperator', 'EmergencyOfficer', 'WellnessAdministrator')
);
