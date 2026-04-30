import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";

interface CategoryBreadcrumbProps {
  categoryName: string;
  path: string[];
  onNavigate: (index: number) => void;
}

const CategoryBreadcrumb = ({ categoryName, path, onNavigate }: CategoryBreadcrumbProps) => {
  if (path.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            className="cursor-pointer"
            onClick={() => onNavigate(-1)}
          >
            {categoryName}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {path.map((segment, i) => (
          <React.Fragment key={i}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === path.length - 1 ? (
                <BreadcrumbPage>{segment}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() => onNavigate(i)}
                >
                  {segment}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default CategoryBreadcrumb;
